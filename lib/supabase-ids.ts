// Tables key rows by bigint (typed `number` in lib/database.types.ts) while
// much of the app carries those ids as strings (URL params, form values,
// view models). Convert at the query boundary instead of casting.

export type BigintIdInput = string | number;

export function toBigintId(id: BigintIdInput): number {
  return typeof id === "number" ? id : Number(id);
}

/** Converts ids for `.in()` filters, dropping values that are not positive integers. */
export function toBigintIds(ids: Iterable<BigintIdInput>): number[] {
  const result: number[] = [];
  for (const id of ids) {
    const value = toBigintId(id);
    if (Number.isSafeInteger(value) && value > 0) result.push(value);
  }
  return result;
}
