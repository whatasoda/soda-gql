import {
  type AnyExecutionResultProjectionMultiple,
  type AnyExecutionResultProjectionSingle,
  type AnyExecutionResultProjections,
  type AnySliceResultRecord,
  ExecutionResultProjection,
  type GraphqlAdapter,
  type InferExecutionResultProjection,
  type SliceResult,
} from "../types";

const evaluateSliceSelectionSingle = <
  TAdapter extends GraphqlAdapter,
  TSelection extends AnyExecutionResultProjectionSingle<TAdapter>,
>(
  selection: TSelection,
  results: AnySliceResultRecord<TAdapter>,
): InferExecutionResultProjection<TAdapter, TSelection> => {
  const key = selection.path.startsWith("$.") ? selection.path.slice(2) : selection.path;
  const target = results[key];
  return selection.projector(target as SliceResult<unknown, TAdapter>);
};

const evaluateSliceSelectionMultiple = <
  TAdapter extends GraphqlAdapter,
  TSelection extends AnyExecutionResultProjectionMultiple<TAdapter>,
>(
  selection: TSelection,
  results: AnySliceResultRecord<TAdapter>,
): InferExecutionResultProjection<TAdapter, TSelection> =>
  Object.fromEntries(
    Object.entries(selection).map(([key, value]) => [key, evaluateSliceSelectionSingle(value, results)]),
  ) as InferExecutionResultProjection<TAdapter, TSelection>;

export const evaluateSelections = <TAdapter extends GraphqlAdapter, TSelection extends AnyExecutionResultProjections<TAdapter>>(
  selection: TSelection,
  results: AnySliceResultRecord<TAdapter>,
): InferExecutionResultProjection<TAdapter, TSelection> =>
  selection instanceof ExecutionResultProjection
    ? evaluateSliceSelectionSingle(selection, results)
    : (evaluateSliceSelectionMultiple(selection, results) as InferExecutionResultProjection<TAdapter, TSelection>);
