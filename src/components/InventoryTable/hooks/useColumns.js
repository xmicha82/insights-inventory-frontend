import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { mergeArraysByKey } from '@redhat-cloud-services/frontend-components-utilities/helpers/helpers';
import { DEFAULT_COLUMNS } from '../../../store/entities';
import isEqual from 'lodash/isEqual';

const isColumnEnabled = (key, disableColumns, showTags) =>
  (key === 'tags' && showTags) ||
  (key !== 'tags' &&
    Array.isArray(disableColumns) &&
    !disableColumns.includes(key));

const useColumns = (
  columnsProp,
  disableDefaultColumns,
  showTags,
  columnsCounter
) => {
  const columnsRedux = useSelector(
    ({ entities: { columns } }) => columns,
    isEqual
  );
  const disabledColumns = Array.isArray(disableDefaultColumns)
    ? disableDefaultColumns
    : [];
  //condition for the newDefaultColumns should be removed after inventory groups is released
  const defaultColumnsFiltered = useMemo(
    () =>
      disableDefaultColumns === true
        ? []
        : DEFAULT_COLUMNS.filter(({ key }) =>
            isColumnEnabled(key, disabledColumns, showTags)
          ),
    [disabledColumns, disableDefaultColumns, showTags]
  );

  return useMemo(() => {
    if (typeof columnsProp === 'function') {
      return columnsProp(DEFAULT_COLUMNS);
    } else if (columnsProp) {
      return mergeArraysByKey([defaultColumnsFiltered, columnsProp], 'key');
    } else if (!columnsProp && columnsRedux) {
      return columnsRedux;
    } else {
      return defaultColumnsFiltered;
    }
  }, [
    columnsProp,
    showTags,
    Array.isArray(disableDefaultColumns)
      ? disableDefaultColumns.join()
      : disableDefaultColumns,
    Array.isArray(columnsProp)
      ? columnsProp.map(({ key }) => key).join()
      : typeof columnsProp === 'function'
      ? 'function'
      : columnsProp,
    Array.isArray(columnsRedux)
      ? columnsRedux.map(({ key }) => key).join()
      : columnsRedux,
    columnsCounter,
  ]);
};

export default useColumns;
