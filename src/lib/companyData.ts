export function isCompanyScopedRecord(record: { company_id?: string | null } | undefined | null, companyId: string | null | undefined) {
  if (!companyId) return true;
  return record?.company_id === companyId;
}

export function filterByCompany<T extends { company_id?: string | null }>(records: T[], companyId: string | null | undefined) {
  if (!companyId) return records;
  return records.filter((record) => record.company_id === companyId);
}

export function withCompanyId<T extends Record<string, unknown>>(companyId: string | null | undefined, payload: T): T & { company_id?: string | null } {
  return companyId ? { ...payload, company_id: companyId } : payload;
}
