//! SWC-based transformer for soda-gql GraphQL code generation.
//!
//! This crate provides a native Node.js module using napi-rs that transforms
//! `gql.default()` calls into `gqlRuntime.*` calls at build time.

mod transform;
mod types;

use napi::bindgen_prelude::*;
use napi_derive::napi;
use types::config::TransformInput;

/// Transform a single source file.
///
/// # Arguments
/// * `input_json` - JSON-serialized TransformInput containing source code, file path, artifact, and config
///
/// # Returns
/// JSON-serialized TransformResult containing the transformed code
#[napi]
pub fn transform(input_json: String) -> Result<String> {
    let input: TransformInput = serde_json::from_str(&input_json)
        .map_err(|e| Error::from_reason(format!("Failed to parse input: {}", e)))?;

    let result = transform::transformer::transform_source(&input)
        .map_err(|e| Error::from_reason(e))?;

    serde_json::to_string(&result)
        .map_err(|e| Error::from_reason(format!("Failed to serialize result: {}", e)))
}

/// Stateful transformer that caches artifact and config for multiple file transformations.
#[napi]
pub struct SwcTransformer {
    artifact_json: String,
    config: types::config::TransformConfig,
}

#[napi]
impl SwcTransformer {
    /// Create a new transformer instance.
    ///
    /// # Arguments
    /// * `artifact_json` - JSON-serialized BuilderArtifact
    /// * `config_json` - JSON-serialized TransformConfig
    #[napi(constructor)]
    pub fn new(artifact_json: String, config_json: String) -> Result<Self> {
        let config: types::config::TransformConfig = serde_json::from_str(&config_json)
            .map_err(|e| Error::from_reason(format!("Failed to parse config: {}", e)))?;

        Ok(SwcTransformer {
            artifact_json,
            config,
        })
    }

    /// Transform a single source file.
    ///
    /// # Arguments
    /// * `source_code` - The source code to transform
    /// * `source_path` - The file path of the source
    ///
    /// # Returns
    /// JSON-serialized TransformResult
    #[napi]
    pub fn transform(&self, source_code: String, source_path: String) -> Result<String> {
        let input = TransformInput {
            source_code,
            source_path,
            artifact_json: self.artifact_json.clone(),
            config: self.config.clone(),
        };

        let result = transform::transformer::transform_source(&input)
            .map_err(|e| Error::from_reason(e))?;

        serde_json::to_string(&result)
            .map_err(|e| Error::from_reason(format!("Failed to serialize result: {}", e)))
    }
}
