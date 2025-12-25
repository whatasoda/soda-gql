//! Main transformation orchestration.
//!
//! This module coordinates the transformation process:
//! 1. Parse source with SWC parser
//! 2. Collect metadata (canonical IDs, export bindings)
//! 3. Visit AST and transform gql.default() calls
//! 4. Manage imports (add runtime, remove graphql-system)
//! 5. Insert runtime calls after imports
//! 6. Emit code with SWC codegen

use serde::{Deserialize, Serialize};
use swc_core::common::comments::SingleThreadedComments;
use swc_core::common::source_map::SourceMapGenConfig;
use swc_core::common::sync::Lrc;
use swc_core::common::{BytePos, FileName, SourceMap};
use swc_core::ecma::ast::*;
use swc_core::ecma::codegen::{text_writer::JsWriter, Emitter};
use swc_core::ecma::parser::{lexer::Lexer, Parser, Syntax, TsSyntax};
use swc_core::ecma::visit::{VisitMut, VisitMutWith, VisitWith};

use crate::types::{BuilderArtifact, TransformInput, TransformInputRef};

use super::analysis::GqlCallFinder;
use super::imports::ImportManager;
use super::metadata::MetadataCollector;
use super::runtime::RuntimeCallBuilder;

use crate::types::PluginError;

/// Result of a transformation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransformResult {
    /// The transformed source code.
    pub output_code: String,

    /// Whether any transformation was performed.
    pub transformed: bool,

    /// Errors encountered during transformation.
    /// These are non-fatal - transformation continues but logs issues.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub errors: Vec<PluginError>,

    /// Source map JSON, if source map generation was enabled.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_map: Option<String>,
}

/// Transform a source file.
///
/// # Arguments
/// * `input` - The transformation input containing source, path, artifact, and config
///
/// # Returns
/// Result containing the transformed code, or an error message
pub fn transform_source(input: &TransformInput) -> Result<TransformResult, String> {
    // Check if this is the graphql-system file - if so, stub it out
    if is_graphql_system_file(&input.source_path, &input.config.graphql_system_path) {
        return Ok(TransformResult {
            output_code: "export {};".to_string(),
            transformed: true,
            errors: Vec::new(),
            source_map: None,
        });
    }

    // Parse the artifact
    let artifact: BuilderArtifact = serde_json::from_str(&input.artifact_json)
        .map_err(|e| format!("Failed to parse artifact: {}", e))?;

    // Create source map
    let cm: Lrc<SourceMap> = Default::default();
    let fm = cm.new_source_file(
        Lrc::new(FileName::Custom(input.source_path.clone())),
        input.source_code.clone(),
    );

    // Determine if this is a TSX file
    let is_tsx = input.source_path.ends_with(".tsx");

    // Create comments storage for preservation
    let comments = SingleThreadedComments::default();

    // Create parser with comments collection
    let lexer = Lexer::new(
        Syntax::Typescript(TsSyntax {
            tsx: is_tsx,
            ..Default::default()
        }),
        EsVersion::Es2022,
        (&*fm).into(),
        Some(&comments),
    );

    let mut parser = Parser::new_from(lexer);
    let mut module = parser
        .parse_module()
        .map_err(|e| format!("Parse error: {:?}", e))?;

    // Collect metadata about GQL definitions
    let metadata = MetadataCollector::collect(&module, &input.source_path);

    // Find and analyze GQL calls
    let mut finder = GqlCallFinder::new(&artifact, &metadata, &input.source_path);
    module.visit_with(&mut finder);

    // If no GQL calls found, return unchanged (but may have errors)
    if !finder.has_transformations() {
        return Ok(TransformResult {
            output_code: input.source_code.clone(),
            transformed: false,
            errors: finder.take_errors(),
            source_map: None,
        });
    }

    // Build runtime calls and transform
    let runtime_builder = RuntimeCallBuilder::new(input.config.is_cjs);
    let mut transformer = GqlTransformer::new(&finder, &runtime_builder, &input.source_path);
    module.visit_mut_with(&mut transformer);

    // Manage imports
    let mut import_manager = ImportManager::new(
        transformer.needs_runtime_import(),
        input.config.is_cjs,
        &input.config.graphql_system_aliases,
    );
    module.visit_mut_with(&mut import_manager);

    // Insert runtime calls after imports
    if !transformer.runtime_calls.is_empty() {
        insert_runtime_calls(&mut module, std::mem::take(&mut transformer.runtime_calls));
    }

    // Emit the transformed code with preserved comments and optional source map
    let emit_output = emit_module(&cm, &module, &comments, input.config.source_map)?;

    // Collect errors from both phases
    // Take transformer errors first, then drop to release borrow of finder
    let transformer_errors = transformer.take_errors();
    drop(transformer);
    // Now we can mutably borrow finder
    let mut errors = finder.take_errors();
    errors.extend(transformer_errors);

    Ok(TransformResult {
        output_code: emit_output.code,
        transformed: true,
        errors,
        source_map: emit_output.source_map,
    })
}

/// Transform a source file with a pre-parsed artifact reference.
///
/// This is more efficient than `transform_source` when transforming multiple files
/// with the same artifact, as it avoids repeated JSON parsing.
///
/// # Arguments
/// * `input` - The transformation input containing source, path, artifact reference, and config
///
/// # Returns
/// Result containing the transformed code, or an error message
pub fn transform_source_ref(input: &TransformInputRef<'_>) -> Result<TransformResult, String> {
    // Check if this is the graphql-system file - if so, stub it out
    if is_graphql_system_file(&input.source_path, &input.config.graphql_system_path) {
        return Ok(TransformResult {
            output_code: "export {};".to_string(),
            transformed: true,
            errors: Vec::new(),
            source_map: None,
        });
    }

    // Create source map
    let cm: Lrc<SourceMap> = Default::default();
    let fm = cm.new_source_file(
        Lrc::new(FileName::Custom(input.source_path.clone())),
        input.source_code.clone(),
    );

    // Determine if this is a TSX file
    let is_tsx = input.source_path.ends_with(".tsx");

    // Create comments storage for preservation
    let comments = SingleThreadedComments::default();

    // Create parser with comments collection
    let lexer = Lexer::new(
        Syntax::Typescript(TsSyntax {
            tsx: is_tsx,
            ..Default::default()
        }),
        EsVersion::Es2022,
        (&*fm).into(),
        Some(&comments),
    );

    let mut parser = Parser::new_from(lexer);
    let mut module = parser
        .parse_module()
        .map_err(|e| format!("Parse error: {:?}", e))?;

    // Collect metadata about GQL definitions
    let metadata = MetadataCollector::collect(&module, &input.source_path);

    // Find and analyze GQL calls (use pre-parsed artifact reference)
    let mut finder = GqlCallFinder::new(input.artifact, &metadata, &input.source_path);
    module.visit_with(&mut finder);

    // If no GQL calls found, return unchanged (but may have errors)
    if !finder.has_transformations() {
        return Ok(TransformResult {
            output_code: input.source_code.clone(),
            transformed: false,
            errors: finder.take_errors(),
            source_map: None,
        });
    }

    // Build runtime calls and transform
    let runtime_builder = RuntimeCallBuilder::new(input.config.is_cjs);
    let mut transformer = GqlTransformer::new(&finder, &runtime_builder, &input.source_path);
    module.visit_mut_with(&mut transformer);

    // Manage imports
    let mut import_manager = ImportManager::new(
        transformer.needs_runtime_import(),
        input.config.is_cjs,
        &input.config.graphql_system_aliases,
    );
    module.visit_mut_with(&mut import_manager);

    // Insert runtime calls after imports
    if !transformer.runtime_calls.is_empty() {
        insert_runtime_calls(&mut module, std::mem::take(&mut transformer.runtime_calls));
    }

    // Emit the transformed code with preserved comments and optional source map
    let emit_output = emit_module(&cm, &module, &comments, input.config.source_map)?;

    // Collect errors from both phases
    let transformer_errors = transformer.take_errors();
    drop(transformer);
    let mut errors = finder.take_errors();
    errors.extend(transformer_errors);

    Ok(TransformResult {
        output_code: emit_output.code,
        transformed: true,
        errors,
        source_map: emit_output.source_map,
    })
}

/// Main AST transformer that replaces gql.default() calls with runtime calls.
struct GqlTransformer<'a> {
    finder: &'a GqlCallFinder<'a>,
    runtime_builder: &'a RuntimeCallBuilder,
    needs_runtime: bool,
    pub runtime_calls: Vec<Stmt>,
    errors: Vec<PluginError>,
    source_path: String,
}

impl<'a> GqlTransformer<'a> {
    fn new(finder: &'a GqlCallFinder<'a>, runtime_builder: &'a RuntimeCallBuilder, source_path: &str) -> Self {
        Self {
            finder,
            runtime_builder,
            needs_runtime: false,
            runtime_calls: Vec::new(),
            errors: Vec::new(),
            source_path: source_path.to_string(),
        }
    }

    fn needs_runtime_import(&self) -> bool {
        self.needs_runtime
    }

    fn take_errors(&mut self) -> Vec<PluginError> {
        std::mem::take(&mut self.errors)
    }
}

impl VisitMut for GqlTransformer<'_> {
    fn visit_mut_expr(&mut self, expr: &mut Expr) {
        // First visit children
        expr.visit_mut_children_with(self);

        // Check if this is a GQL call that should be transformed
        if let Expr::Call(call) = expr {
            if let Some(replacement) = self.finder.get_replacement(call) {
                // Mark that we need the runtime import
                self.needs_runtime = true;

                // Build the replacement expression
                if let Some((reference_expr, runtime_stmt)) =
                    self.runtime_builder.build_replacement(replacement)
                {
                    // Store the runtime statement to be inserted later
                    if let Some(stmt) = runtime_stmt {
                        self.runtime_calls.push(stmt);
                    }

                    // Replace the expression
                    *expr = reference_expr;
                } else {
                    // Record structured error when replacement build fails
                    let artifact_type = match &replacement.artifact {
                        crate::types::BuilderArtifactElement::Model { .. } => "model",
                        crate::types::BuilderArtifactElement::Operation { .. } => "operation",
                    };
                    let error = PluginError::missing_builder_arg(
                        &self.source_path,
                        artifact_type,
                        "builder callback",
                    );
                    eprintln!("[swc-transformer] {}", error.format());
                    self.errors.push(error);
                }
            }
        }
    }
}

/// Insert runtime calls after the last import statement.
fn insert_runtime_calls(module: &mut Module, calls: Vec<Stmt>) {
    if calls.is_empty() {
        return;
    }

    // Find the position after the last import
    let mut insert_pos = 0;
    for (i, item) in module.body.iter().enumerate() {
        if matches!(item, ModuleItem::ModuleDecl(ModuleDecl::Import(_))) {
            insert_pos = i + 1;
        }
    }

    // Insert runtime calls
    let items: Vec<ModuleItem> = calls.into_iter().map(ModuleItem::Stmt).collect();
    module.body.splice(insert_pos..insert_pos, items);
}

/// Output from code emission.
struct EmitOutput {
    code: String,
    source_map: Option<String>,
}

/// Configuration for source map generation.
struct SimpleSourceMapConfig;

impl SourceMapGenConfig for SimpleSourceMapConfig {
    fn file_name_to_source(&self, f: &FileName) -> String {
        match f {
            FileName::Real(path) => path.to_string_lossy().to_string(),
            FileName::Custom(name) => name.clone(),
            FileName::Url(url) => url.to_string(),
            _ => "unknown".to_string(),
        }
    }

    fn name_for_bytepos(&self, _bpos: BytePos) -> Option<&str> {
        None
    }

    fn inline_sources_content(&self, _f: &FileName) -> bool {
        true // Include source content in the source map
    }
}

/// Emit the module as JavaScript code with preserved comments.
fn emit_module(
    cm: &Lrc<SourceMap>,
    module: &Module,
    comments: &SingleThreadedComments,
    generate_source_map: bool,
) -> Result<EmitOutput, String> {
    let mut buf = vec![];
    let mut srcmap_buf = if generate_source_map {
        Some(vec![])
    } else {
        None
    };

    {
        let writer = JsWriter::new(
            cm.clone(),
            "\n",
            &mut buf,
            srcmap_buf.as_mut(),
        );
        let mut emitter = Emitter {
            cfg: swc_core::ecma::codegen::Config::default().with_minify(false),
            cm: cm.clone(),
            comments: Some(comments),
            wr: writer,
        };

        emitter
            .emit_module(module)
            .map_err(|e| format!("Emit error: {:?}", e))?;
    }

    let code = String::from_utf8(buf).map_err(|e| format!("UTF-8 error: {}", e))?;

    let source_map = if let Some(srcmap) = srcmap_buf {
        // Build source map from collected entries
        let config = SimpleSourceMapConfig;
        let map = cm.build_source_map(&srcmap, None, config);
        let mut map_buf = vec![];
        map.to_writer(&mut map_buf)
            .map_err(|e| format!("Source map error: {:?}", e))?;
        Some(String::from_utf8(map_buf).map_err(|e| format!("Source map UTF-8 error: {}", e))?)
    } else {
        None
    };

    Ok(EmitOutput { code, source_map })
}

/// Check if the source file is the graphql-system file.
/// Both paths should be normalized (forward slashes) before comparison.
fn is_graphql_system_file(source_path: &str, graphql_system_path: &Option<String>) -> bool {
    match graphql_system_path {
        Some(gql_path) => {
            // Normalize both paths for comparison (remove trailing slashes, normalize separators)
            let normalized_source = source_path.replace('\\', "/");
            let normalized_gql = gql_path.replace('\\', "/");
            normalized_source == normalized_gql
        }
        None => false,
    }
}
