import React from 'react';
import {
  ACTION_TYPES,
  CHANGE_SORT,
  CLEAR_ENTITIES,
  CLEAR_ERRORS,
  CLEAR_FILTERS,
  ENTITIES_LOADING,
  FILTER_SELECT,
  SELECT_ENTITY,
  SHOW_ENTITIES,
  TOGGLE_TAG_MODAL,
  UPDATE_ENTITIES,
} from './action-types';
import { mergeArraysByKey } from '@redhat-cloud-services/frontend-components-utilities/helpers';
import { DateFormat } from '@redhat-cloud-services/frontend-components/DateFormat';
import { CullingInformation } from '@redhat-cloud-services/frontend-components/CullingInfo';
import { TagWithDialog } from '../Utilities/index';
import { REPORTER_PUPTOO } from '../Utilities/constants';
import groupBy from 'lodash/groupBy';
import TitleColumn from '../components/InventoryTable/TitleColumn';
import InsightsDisconnected from '../Utilities/InsightsDisconnected';
import OperatingSystemFormatter from '../Utilities/OperatingSystemFormatter';
import { Tooltip } from '@patternfly/react-core';
import { verifyCulledReporter } from '../Utilities/sharedFunctions';
import { fitContent } from '@patternfly/react-table';
import isEmpty from 'lodash/isEmpty';
import { LastSeenColumnHeader } from '../Utilities/LastSeenColumnHeader';

export const defaultState = {
  loaded: false,
  tagsLoaded: false,
  allTagsLoaded: false,
  groups: [],
  invConfig: {},
  sortBy: {
    key: 'updated',
    direction: 'desc',
  },
};

export const DEFAULT_COLUMNS = [
  {
    key: 'display_name',
    sortKey: 'display_name',
    title: 'Name',
    renderFunc: (display_name, id, item, props) => (
      <TitleColumn {...{ ...props, id, item }}>{display_name}</TitleColumn>
    ),
  },
  {
    key: 'groups',
    sortKey: 'group_name',
    title: 'Workspace',
    props: { width: 10 },

    renderFunc: (groups) =>
      isEmpty(groups) ? (
        <div className="pf-v5-u-disabled-color-200">No workspace</div>
      ) : (
        groups[0].name
      ), // currently, one group at maximum is supported
    transforms: [fitContent],
  },
  {
    key: 'tags',
    title: 'Tags',
    props: { width: 10, isStatic: true },

    renderFunc: (value, systemId) => (
      <TagWithDialog count={value.length} systemId={systemId} />
    ),
  },
  {
    key: 'system_profile',
    sortKey: 'operating_system',
    dataLabel: 'OS',
    title: (
      <Tooltip content={<span>Operating system</span>}>
        <span>OS</span>
      </Tooltip>
    ),

    renderFunc: (systemProfile) => (
      <OperatingSystemFormatter
        operatingSystem={systemProfile?.operating_system}
      />
    ),
    props: { width: 10 },
  },
  {
    key: 'updated',
    sortKey: 'updated',
    dataLabel: 'Last seen',
    title: <LastSeenColumnHeader />,

    renderFunc: (
      value,
      _id,
      {
        culled_timestamp: culled,
        stale_warning_timestamp: staleWarn,
        stale_timestamp: stale,
        per_reporter_staleness: perReporterStaleness,
      },
    ) => {
      return CullingInformation ? (
        <CullingInformation
          culled={culled}
          staleWarning={staleWarn}
          stale={stale}
          render={({ msg }) => (
            <React.Fragment>
              <DateFormat
                date={value}
                extraTitle={
                  <React.Fragment>
                    <div>{msg}</div>
                    Last seen:{` `}
                  </React.Fragment>
                }
              />
              {verifyCulledReporter(perReporterStaleness, REPORTER_PUPTOO) && (
                <InsightsDisconnected />
              )}
            </React.Fragment>
          )}
        >
          {' '}
          <DateFormat date={value} />{' '}
        </CullingInformation>
      ) : (
        new Date(value).toLocaleString()
      );
    },
    props: { width: 10 },
    transforms: [fitContent],
  },
];

function entitiesPending(state, { meta }) {
  return {
    ...state,
    ...((state.columns && {
      columns: mergeArraysByKey(
        [
          DEFAULT_COLUMNS.filter(({ key }) => key !== 'tags' || meta?.showTags),
          state.columns,
        ],
        'key',
      ),
    }) ||
      {}),
    rows: [],
    loaded: false,
    lastDateRequest: meta.lastDateRequest,
  };
}

function clearFilters(state) {
  return {
    ...state,
    activeFilters: [],
  };
}

const clearEntities = () => {
  return defaultState;
};

function entitiesLoaded(
  state,
  {
    payload: {
      results,
      per_page: perPage,
      page,
      count,
      total,
      loaded,
      filters,
      sortBy,
    },
    meta,
  },
) {
  // Older requests should not rewrite the state
  if (meta.lastDateRequest < state.lastDateRequest) {
    return state;
  }

  // Data are loaded and APi returned malicious data
  if (loaded === undefined && (page === undefined || perPage === undefined)) {
    return state;
  }

  if (meta?.controller?.signal?.aborted === true) {
    return defaultState;
  }

  return {
    ...state,
    activeFilters: filters || [],
    loaded: loaded === undefined || loaded,
    // filter data only if we are loaded
    rows: mergeArraysByKey([state.rows, results]).filter((item) =>
      !loaded ? true : item.created,
    ),
    perPage: perPage !== undefined ? perPage : state.perPage,
    page: page !== undefined ? page : state.page,
    count: count !== undefined ? count : state.count,
    total: total !== undefined ? total : state.total,
    sortBy: sortBy !== undefined ? sortBy : state.sortBy,
  };
}

function loadingRejected(state, { payload }) {
  return {
    ...state,
    error: payload,
  };
}

function selectEntity(state, { payload }) {
  const rows = [...state.rows];
  let toSelect = [];
  if (Array.isArray(payload.id)) {
    toSelect = payload.id.map((item) => {
      return {
        id: item,
        selected: payload?.selected,
      };
    });
  } else {
    toSelect = [].concat(payload);
  }

  toSelect.forEach(({ id, selected }) => {
    const entity = rows.find((entity) => entity.id === id);
    if (entity) {
      entity.selected = selected;
    } else {
      rows.forEach((item) => (item.selected = selected));
    }
  });
  return {
    ...state,
    rows,
  };
}

function changeSort(state, { payload: { key, direction } }) {
  return {
    ...state,
    sortBy: {
      key,
      direction,
    },
  };
}

function selectFilter(
  state,
  {
    payload: {
      item: { items, ...item },
      selected,
    },
  },
) {
  let { activeFilters = [] } = state;
  if (selected) {
    activeFilters = [...activeFilters, item, ...(items ? items : [])];
    const values = activeFilters.map((active) => active.value);
    activeFilters = activeFilters.filter(
      (filter, key) => values.lastIndexOf(filter.value) === key,
    );
  } else {
    activeFilters.splice(
      activeFilters.map((active) => active.value).indexOf(item.value),
      1,
    );
    if (items) {
      items.forEach((subItem) => {
        activeFilters.splice(
          activeFilters.map((active) => active.value).indexOf(subItem.value),
          1,
        );
      });
    }
  }

  return {
    ...state,
    activeFilters,
  };
}

const getActiveSystemTag = (state, meta) => {
  if (state.rows) {
    return state.rows.find(
      ({ id, insightsId, insights_id }) =>
        meta.systemId === insightsId || insights_id || id,
    );
  }
  if (state.entity) {
    return state.entity;
  }
  return {};
};

export function showTags(state, { payload, meta }) {
  const activeSystemTag = getActiveSystemTag(state, meta);

  return {
    ...state,
    tagModalLoaded: true,
    activeSystemTag: {
      ...activeSystemTag,
      tags: Object.values(payload.results)[0],
      tagsCount: meta.tagsCount,
      page: payload.page,
      perPage: payload.per_page,
      tagsLoaded: true,
    },
  };
}

export function showTagsPending(state, { meta }) {
  const activeSystemTag = getActiveSystemTag(state, meta);

  return {
    ...state,
    tagModalLoaded: false,
    activeSystemTag: {
      ...activeSystemTag,
      tagsCount: meta.tagsCount,
      tagsLoaded: false,
    },
  };
}

export function toggleTagModalReducer(state, { payload: { isOpen } }) {
  return {
    ...state,
    showTagDialog: isOpen,
    activeSystemTag: undefined,
  };
}

export function allTags(
  state,
  {
    payload: { results, total, page, per_page: perPage },
    meta: { lastDateRequestTags },
  },
) {
  // only the latest request can change state
  if (lastDateRequestTags < state.lastDateRequestTags) {
    return state;
  }

  return {
    ...state,
    allTags: Object.entries(
      groupBy(results, ({ tag: { namespace } }) => namespace),
    ).map(([key, value]) => ({
      name: key,
      tags: value,
    })),
    allTagsPagination: {
      perPage,
      page,
    },
    additionalTagsCount: total > perPage ? total - perPage : 0,
    allTagsTotal: total,
    allTagsLoaded: true,
    tagModalLoaded: true,
  };
}

export default {
  [ACTION_TYPES.ALL_TAGS_FULFILLED]: allTags,
  [ACTION_TYPES.ALL_TAGS_PENDING]: (state, { meta }) => ({
    ...state,
    allTagsLoaded: false,
    tagModalLoaded: false,
    lastDateRequestTags: meta.lastDateRequestTags,
  }),
  [ACTION_TYPES.LOAD_ENTITIES_PENDING]: entitiesPending,
  [ACTION_TYPES.LOAD_ENTITIES_FULFILLED]: entitiesLoaded,
  [ACTION_TYPES.LOAD_ENTITIES_REJECTED]: loadingRejected,
  [ACTION_TYPES.LOAD_TAGS_PENDING]: showTagsPending,
  [ACTION_TYPES.LOAD_TAGS_FULFILLED]: showTags,
  [ACTION_TYPES.ALL_TAGS_REJECTED]: loadingRejected,
  [UPDATE_ENTITIES]: entitiesLoaded,
  [SHOW_ENTITIES]: (state, action) =>
    entitiesLoaded(state, {
      payload: {
        ...action.payload,
        loaded: false,
      },
    }),
  [FILTER_SELECT]: selectFilter,
  [SELECT_ENTITY]: selectEntity,
  [CHANGE_SORT]: changeSort,
  [CLEAR_FILTERS]: clearFilters,
  [ENTITIES_LOADING]: (state, { payload: { isLoading } }) => ({
    ...state,
    loaded: !isLoading,
  }),
  [TOGGLE_TAG_MODAL]: toggleTagModalReducer,
  [CLEAR_ENTITIES]: clearEntities,
  [CLEAR_ERRORS]: (state) => ({ ...state, error: null }),
};
