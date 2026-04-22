import {
  collection,
  doc,
  orderBy,
  query,
  QueryConstraint,
  where,
  type CollectionReference,
  type DocumentReference,
  type Query,
} from 'firebase/firestore';
import { db } from './firebase';

export function requireCompanyId(companyId: string | null | undefined): string {
  if (!companyId) {
    throw new Error('A company workspace is required for this action.');
  }

  return companyId;
}

export function companyCollection(name: string, companyId: string | null | undefined): Query {
  return query(collection(db, name), where('company_id', '==', requireCompanyId(companyId)));
}

export function companyQuery(name: string, companyId: string | null | undefined, ...constraints: QueryConstraint[]): Query {
  return query(collection(db, name), where('company_id', '==', requireCompanyId(companyId)), ...constraints);
}

export function orderedCompanyQuery(
  name: string,
  companyId: string | null | undefined,
  orderField: string,
  direction: 'asc' | 'desc' = 'asc',
  ...constraints: QueryConstraint[]
): Query {
  return query(
    collection(db, name),
    where('company_id', '==', requireCompanyId(companyId)),
    ...constraints,
    orderBy(orderField, direction)
  );
}

export function companySubcollection(
  path: string,
  companyId: string | null | undefined,
  ...constraints: QueryConstraint[]
): Query {
  return query(collection(db, path), where('company_id', '==', requireCompanyId(companyId)), ...constraints);
}

export function newCompanyDoc(name: string, companyId: string | null | undefined): DocumentReference {
  requireCompanyId(companyId);
  return doc(collection(db, name) as CollectionReference);
}
