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
}

impl Default for TransformConfig {
    fn default() -> Self {
        Self {
            graphql_system_aliases: vec!["@/graphql-system".to_string()],
            is_cjs: false,
        }
    }
}

/// Input for a single file transformation.
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
