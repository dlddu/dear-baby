// Records hook — exposes the AsyncStorage-backed record list with a small
// reload/save API. Components should treat the returned array as
// immutable and go through `refresh` / `save` to mutate it.
//
// We also re-use React's focus effect pattern: the records tab should
// reload every time the user navigates back to it, so freshly-saved
// entries appear without pull-to-refresh.

import { useCallback, useEffect, useState } from 'react';

import {
  listRecords,
  saveRecord as saveRecordToStorage,
  updateRecord as updateRecordInStorage,
} from './storage';
import type { Record } from './types';

export type UseRecordsValue = {
  records: Record[];
  loading: boolean;
  refresh: () => Promise<void>;
  save: (record: Record) => Promise<void>;
  update: (record: Record) => Promise<void>;
};

export function useRecords(): UseRecordsValue {
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const all = await listRecords();
    setRecords(all);
    setLoading(false);
  }, []);

  const save = useCallback(
    async (record: Record) => {
      await saveRecordToStorage(record);
      await refresh();
    },
    [refresh],
  );

  const update = useCallback(
    async (record: Record) => {
      await updateRecordInStorage(record);
      await refresh();
    },
    [refresh],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { records, loading, refresh, save, update };
}
