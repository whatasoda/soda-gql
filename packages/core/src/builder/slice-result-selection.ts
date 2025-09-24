import {
  type AnySliceResultRecord,
  type AnySliceResultProjectionMultiple,
  type AnySliceResultProjectionSingle,
  type AnySliceResultProjections,
  type GraphqlAdapter,
  type InferSliceResultProjection,
  type SliceResult,
  SliceResultProjection,
} from "../types";

const evaluateSliceSelectionSingle = <
  TAdapter extends GraphqlAdapter,
  TSelection extends AnySliceResultProjectionSingle<TAdapter>,
>(
  selection: TSelection,
  results: AnySliceResultRecord<TAdapter>,
): InferSliceResultProjection<TAdapter, TSelection> => {
  const key = selection.path.startsWith("$.") ? selection.path.slice(2) : selection.path;
  const target = results[key];
  return selection.projector(target as SliceResult<unknown, TAdapter>);
};

const evaluateSliceSelectionMultiple = <
  TAdapter extends GraphqlAdapter,
  TSelection extends AnySliceResultProjectionMultiple<TAdapter>,
>(
  selection: TSelection,
  results: AnySliceResultRecord<TAdapter>,
): InferSliceResultProjection<TAdapter, TSelection> =>
  Object.fromEntries(
    Object.entries(selection).map(([key, value]) => [key, evaluateSliceSelectionSingle(value, results)]),
  ) as InferSliceResultProjection<TAdapter, TSelection>;

export const evaluateSelections = <TAdapter extends GraphqlAdapter, TSelection extends AnySliceResultProjections<TAdapter>>(
  selection: TSelection,
  results: AnySliceResultRecord<TAdapter>,
): InferSliceResultProjection<TAdapter, TSelection> =>
  selection instanceof SliceResultProjection
    ? evaluateSliceSelectionSingle(selection, results)
    : (evaluateSliceSelectionMultiple(selection, results) as InferSliceResultProjection<TAdapter, TSelection>);
