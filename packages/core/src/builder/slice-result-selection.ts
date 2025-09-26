import {
  type AnyExecutionResultProjectionMultiple,
  type AnyExecutionResultProjectionSingle,
  type AnyExecutionResultProjections,
  type AnySliceResultRecord,
  ExecutionResultProjection,
  type GraphqlRuntimeAdapter,
  type InferExecutionResultProjection,
  type SliceResult,
} from "../types";

const evaluateSliceSelectionSingle = <
  TRuntimeAdapter extends GraphqlRuntimeAdapter,
  TSelection extends AnyExecutionResultProjectionSingle<TRuntimeAdapter>,
>(
  selection: TSelection,
  results: AnySliceResultRecord<TRuntimeAdapter>,
): InferExecutionResultProjection<TRuntimeAdapter, TSelection> => {
  const key = selection.path.startsWith("$.") ? selection.path.slice(2) : selection.path;
  const target = results[key];
  return selection.projector(target as SliceResult<unknown, TRuntimeAdapter>);
};

const evaluateSliceSelectionMultiple = <
  TRuntimeAdapter extends GraphqlRuntimeAdapter,
  TSelection extends AnyExecutionResultProjectionMultiple<TRuntimeAdapter>,
>(
  selection: TSelection,
  results: AnySliceResultRecord<TRuntimeAdapter>,
): InferExecutionResultProjection<TRuntimeAdapter, TSelection> =>
  Object.fromEntries(
    Object.entries(selection).map(([key, value]) => [key, evaluateSliceSelectionSingle(value, results)]),
  ) as InferExecutionResultProjection<TRuntimeAdapter, TSelection>;

export const evaluateSelections = <
  TRuntimeAdapter extends GraphqlRuntimeAdapter,
  TSelection extends AnyExecutionResultProjections<TRuntimeAdapter>,
>(
  selection: TSelection,
  results: AnySliceResultRecord<TRuntimeAdapter>,
): InferExecutionResultProjection<TRuntimeAdapter, TSelection> =>
  selection instanceof ExecutionResultProjection
    ? evaluateSliceSelectionSingle(selection, results)
    : (evaluateSliceSelectionMultiple(selection, results) as InferExecutionResultProjection<TRuntimeAdapter, TSelection>);
