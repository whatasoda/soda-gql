//! Structured error types for the transformer.
//!
//! This module defines error types that match @soda-gql/plugin-common/errors.ts
//! for consistent error reporting across TypeScript and Rust implementations.

use serde::{Deserialize, Serialize};

/// Stage where the error occurred.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ErrorStage {
    Analysis,
    Transform,
}

/// Base structure for all plugin errors.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginError {
    /// Always "PluginError" for type discrimination.
    #[serde(rename = "type")]
    pub error_type: String,

    /// Error code for programmatic handling.
    pub code: String,

    /// Human-readable error message.
    pub message: String,

    /// Stage where the error occurred.
    pub stage: ErrorStage,

    /// Additional context about the error.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filename: Option<String>,

    /// Canonical ID if applicable.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub canonical_id: Option<String>,

    /// Artifact type if applicable.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artifact_type: Option<String>,

    /// Builder type if applicable.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub builder_type: Option<String>,

    /// Argument name if applicable.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub arg_name: Option<String>,
}

impl PluginError {
    /// Create a "metadata not found" error.
    pub fn metadata_not_found(filename: &str) -> Self {
        Self {
            error_type: "PluginError".to_string(),
            code: "SODA_GQL_METADATA_NOT_FOUND".to_string(),
            message: format!("No metadata found for gql call in '{}'", filename),
            stage: ErrorStage::Analysis,
            filename: Some(filename.to_string()),
            canonical_id: None,
            artifact_type: None,
            builder_type: None,
            arg_name: None,
        }
    }

    /// Create an "artifact not found" error.
    pub fn artifact_not_found(filename: &str, canonical_id: &str) -> Self {
        Self {
            error_type: "PluginError".to_string(),
            code: "SODA_GQL_ANALYSIS_ARTIFACT_NOT_FOUND".to_string(),
            message: format!(
                "No artifact found for canonical ID '{}' in '{}'",
                canonical_id, filename
            ),
            stage: ErrorStage::Analysis,
            filename: Some(filename.to_string()),
            canonical_id: Some(canonical_id.to_string()),
            artifact_type: None,
            builder_type: None,
            arg_name: None,
        }
    }

    /// Create a "missing builder arg" error.
    pub fn missing_builder_arg(filename: &str, builder_type: &str, arg_name: &str) -> Self {
        Self {
            error_type: "PluginError".to_string(),
            code: "SODA_GQL_TRANSFORM_MISSING_BUILDER_ARG".to_string(),
            message: format!(
                "Missing required builder argument '{}' for {} in '{}'",
                arg_name, builder_type, filename
            ),
            stage: ErrorStage::Transform,
            filename: Some(filename.to_string()),
            canonical_id: None,
            artifact_type: None,
            builder_type: Some(builder_type.to_string()),
            arg_name: Some(arg_name.to_string()),
        }
    }

    /// Format the error into a human-readable message.
    pub fn format(&self) -> String {
        format!("[{}] ({:?}) {}", self.code, self.stage, self.message)
    }
}

/// Collection of errors from a transformation.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TransformErrors {
    pub errors: Vec<PluginError>,
}

impl TransformErrors {
    pub fn new() -> Self {
        Self { errors: Vec::new() }
    }

    pub fn push(&mut self, error: PluginError) {
        // Log the error to stderr for visibility
        eprintln!("[swc] {}", error.format());
        self.errors.push(error);
    }

    pub fn is_empty(&self) -> bool {
        self.errors.is_empty()
    }
}
