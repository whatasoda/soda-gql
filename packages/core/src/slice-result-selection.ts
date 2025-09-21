import {
  type AnySliceResultRecord,
  type AnySliceResultSelectionMultiple,
  type AnySliceResultSelectionSingle,
  type AnySliceResultSelections,
  type GraphqlAdapter,
  type InferSliceResultSelection,
  type SliceResult,
  SliceResultSelection,
} from "./types";

const evaluateSliceSelectionSingle = <
  TAdapter extends GraphqlAdapter,
  TSelection extends AnySliceResultSelectionSingle<TAdapter>,
>(
  selection: TSelection,
  results: AnySliceResultRecord<TAdapter>,
): InferSliceResultSelection<TAdapter, TSelection> => {
  const key = selection.path.startsWith("$.") ? selection.path.slice(2) : selection.path;
  const target = results[key];
  return selection.projector(target as SliceResult<unknown, TAdapter>);
};

const evaluateSliceSelectionMultiple = <
  TAdapter extends GraphqlAdapter,
  TSelection extends AnySliceResultSelectionMultiple<TAdapter>,
>(
  selection: TSelection,
  results: AnySliceResultRecord<TAdapter>,
): InferSliceResultSelection<TAdapter, TSelection> =>
  Object.fromEntries(
    Object.entries(selection).map(([key, value]) => [key, evaluateSliceSelectionSingle(value, results)]),
  ) as InferSliceResultSelection<TAdapter, TSelection>;

export const evaluateSelections = <TAdapter extends GraphqlAdapter, TSelection extends AnySliceResultSelections<TAdapter>>(
  selection: TSelection,
  results: AnySliceResultRecord<TAdapter>,
): InferSliceResultSelection<TAdapter, TSelection> =>
  selection instanceof SliceResultSelection
    ? evaluateSliceSelectionSingle(selection, results)
    : (evaluateSliceSelectionMultiple(selection, results) as InferSliceResultSelection<TAdapter, TSelection>);
