//! Configuration types for the transformer.

use serde::{Deserialize, Serialize};

/// Configuration for the transformer.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransformConfig {
    /// Aliases used to identify graphql-system imports.
    /// e.g., ["@/graphql-system", "./graphql-system"]
    pub graphql_system_aliases: Vec<String>,

    /// Whether to generate CommonJS output.
    /// If false, generates ESM output.
    #[serde(default)]
    pub is_cjs: bool,

    /// The canonical path to the graphql-system file.
    /// When the source file matches this path, it will be stubbed out.
    /// This is resolved by the TypeScript wrapper and passed to Rust.
    #[serde(default)]
    pub graphql_system_path: Option<String>,

    /// Canonical paths to inject module files (scalars, adapter).
    /// When the source file matches any of these paths, it will be stubbed out.
    /// These are resolved by the TypeScript wrapper and passed to Rust.
    #[serde(default)]
    pub inject_paths: Vec<String>,

    /// Whether to generate source maps.
    /// If true, a source map will be included in the output.
    #[serde(default)]
    pub source_map: bool,
}

impl Default for TransformConfig {
    fn default() -> Self {
        Self {
            graphql_system_aliases: vec!["@/graphql-system".to_string()],
            is_cjs: false,
            graphql_system_path: None,
            inject_paths: Vec::new(),
            source_map: false,
        }
    }
}

/// Input for a single file transformation (JSON-based, for one-shot transform).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransformInput {
    /// The source code to transform.
    pub source_code: String,

    /// The file path of the source.
    pub source_path: String,

    /// JSON-serialized BuilderArtifact.
    pub artifact_json: String,

    /// Transformation configuration.
    pub config: TransformConfig,
}

/// Input for a single file transformation with pre-parsed artifact.
/// Used by SwcTransformer to avoid repeated JSON parsing.
pub struct TransformInputRef<'a> {
    /// The source code to transform.
    pub source_code: String,

    /// The file path of the source.
    pub source_path: String,

    /// Pre-parsed BuilderArtifact reference.
    pub artifact: &'a super::BuilderArtifact,

    /// Transformation configuration.
    pub config: TransformConfig,
}
