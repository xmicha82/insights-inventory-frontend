import { addNotification } from '@redhat-cloud-services/frontend-components-notifications/redux';
import {
  ACTION_TYPES,
  CHANGE_SORT,
  CLEAR_FILTERS,
  ENTITIES_LOADING,
  FILTER_ENTITIES,
  FILTER_SELECT,
  SELECT_ENTITY,
  TOGGLE_DRAWER,
  TOGGLE_TAG_MODAL,
  UPDATE_ENTITIES,
} from './action-types';
import {
  getAllTags as defaultGetAllTags,
  getEntities as defaultGetEntities,
  filtersReducer,
  getEntitySystemProfile,
  getOperatingSystems,
  getTags,
} from '../api';
import {
  getGroupDetail,
  getGroups,
} from '../components/InventoryGroups/utils/api';
import { deleteHostById, patchHostById } from '../api/hostInventoryApi';

export const loadEntities = (
  items = [],
  { filters, ...config },
  { showTags } = {},
  getEntities = defaultGetEntities,
) => {
  const itemIds = items
    .reduce(
      (acc, curr) => [
        ...acc,
        curr && typeof curr === 'string' ? curr : curr.id,
      ],
      [],
    )
    .filter(Boolean);

  const isFilterDisabled = (name) =>
    config.hideFilters?.[name] ||
    (config.hideFilters?.all && config.hideFilters?.[name] !== false);

  const updatedFilters = filters
    ? filters.reduce(filtersReducer, {
        ...(filters.length === 0 && { registeredWithFilter: [] }),
        ...(isFilterDisabled('stale') && { staleFilter: undefined }),
        ...(isFilterDisabled('registeredWith') && {
          registeredWithFilter: undefined,
        }),
        ...(isFilterDisabled('operating_system') && { osFilter: undefined }),
        ...(isFilterDisabled('host_group') && { hostGroupFilter: undefined }),
      })
    : {
        ...(isFilterDisabled('stale') && { staleFilter: undefined }),
        ...(isFilterDisabled('last_seen') && { lastSeenFilter: undefined }),
        ...(isFilterDisabled('registeredWith') && {
          registeredWithFilter: undefined,
        }),
        ...(isFilterDisabled('operating_system') && { osFilter: undefined }),
        ...(isFilterDisabled('host_group') && { hostGroupFilter: undefined }),
      };

  const orderBy = config.orderBy || 'updated';
  const orderDirection = config.orderDirection?.toUpperCase() || 'DESC';

  const lastDateRequest = Date.now();

  return {
    type: ACTION_TYPES.LOAD_ENTITIES,
    payload: getEntities(
      itemIds,
      {
        filters: updatedFilters,
        ...config,
        orderBy,
        orderDirection,
      },
      showTags,
      defaultGetEntities,
    )
      .then(({ results, ...data }) => ({
        ...data,
        filters,
        sortBy: { key: orderBy, direction: orderDirection.toLowerCase() },
        results:
          items.length > 0
            ? items.map((item) => ({
                ...(item.id ? item : { id: item }),
                ...(results.find(({ id }) => id === item || id === item.id) ||
                  {}),
              }))
            : results,
        page: config.page || data?.page,

        per_page: config.per_page || data?.per_page,
        hideFilters: config.hideFilters,
      }))
      .catch((error) => {
        //Somehow this catch block hides prior JS errors. Log is intended to be aware of them
        console.error(error);
        throw { ...error, type: 'LOAD_ENTITIES' };
      }),
    meta: {
      showTags,
      lastDateRequest,
      controller: config.controller,
    },
  };
};

export const updateEntities = (items = []) => ({
  type: UPDATE_ENTITIES,
  payload: {
    results: items,
  },
});

export const filterSelect = (selectedItem) => ({
  type: FILTER_SELECT,
  payload: selectedItem,
});

export const loadEntity = (id, config, { showTags }) => ({
  type: ACTION_TYPES.LOAD_ENTITY,
  payload: defaultGetEntities(id, config, showTags),
  meta: {
    showTags,
  },
});

export const selectEntity = (id, selected) => ({
  type: SELECT_ENTITY,
  payload: { id, selected },
});

export const changeSort = (data) => ({
  type: CHANGE_SORT,
  payload: data,
});

export const filterEntities = (key, filterString) => ({
  type: FILTER_ENTITIES,
  payload: { key, filterString },
});

export const entitiesLoading = (isLoading = true) => ({
  type: ENTITIES_LOADING,
  payload: { isLoading },
});

export const clearFilters = () => ({
  type: CLEAR_FILTERS,
});

export const systemProfile = (itemId) => ({
  type: ACTION_TYPES.LOAD_SYSTEM_PROFILE,
  payload: getEntitySystemProfile(itemId, {}),
});

export const editDisplayName = (id, value) => ({
  type: ACTION_TYPES.SET_DISPLAY_NAME,
  payload: patchHostById({
    hostIdList: [id],
    patchHostIn: { display_name: value },
  }),
  meta: {
    notifications: {
      fulfilled: {
        variant: 'success',
        title: 'Display name has been updated',
        dismissable: true,
      },
    },
  },
});

export const editAnsibleHost = (id, value) => ({
  type: ACTION_TYPES.SET_ANSIBLE_HOST,
  payload: patchHostById({
    hostIdList: [id],
    patchHostIn: { ansible_host: value },
  }),
  meta: {
    notifications: {
      fulfilled: {
        variant: 'success',
        title: 'Ansible hostname has been updated',
        dismissable: true,
      },
    },
  },
});

export const loadTags = (systemId, search, options, count) => ({
  type: ACTION_TYPES.LOAD_TAGS,
  payload: getTags(systemId, search, options),
  meta: {
    tagsCount: count,
    systemId,
  },
});

export const toggleTagModal = (isOpen) => ({
  type: TOGGLE_TAG_MODAL,
  payload: { isOpen },
});

export const fetchAllTags = (
  search,
  pagination,
  getTags = defaultGetAllTags,
) => ({
  type: ACTION_TYPES.ALL_TAGS,
  payload: getTags(search, pagination),
  meta: { lastDateRequestTags: Date.now() },
});

export const fetchGroups = (search, pagination) => ({
  type: ACTION_TYPES.GROUPS,
  payload: getGroups(search, pagination),
  meta: {
    noError: true, // turns of automatic notification
  },
});

export const fetchGroupDetail = (groupId) => ({
  type: ACTION_TYPES.GROUP_DETAIL,
  payload: getGroupDetail(groupId),
});

export const fetchOperatingSystems = (params = [], showCentosVersions) => ({
  type: ACTION_TYPES.OPERATING_SYSTEMS,
  payload: getOperatingSystems(params, showCentosVersions),
});

export const deleteEntity = (systems, displayName) => ({
  type: ACTION_TYPES.REMOVE_ENTITY,
  payload: deleteHostById({ hostIdList: systems }),
  meta: {
    notifications: {
      fulfilled: {
        variant: 'success',
        title: 'Delete operation finished',
        description: `${displayName} has been successfully removed.`,
        dismissable: true,
      },
    },
    systems,
  },
});

export const toggleDrawer = (isOpened) => ({
  type: TOGGLE_DRAWER,
  payload: { isOpened },
});

export const exportSuccessNotifiction = () =>
  addNotification({
    id: 'inventory-export-success',
    variant: 'info',
    title:
      'The requested export is being prepared. When ready, the download will start automatically.',
  });

export const exportErrorNotifiction = () =>
  addNotification({
    id: 'inventory-export-error',
    variant: 'danger',
    title: 'The requested export could not be created. Please try again.',
  });

export const exportDownloadNotifiction = () =>
  addNotification({
    id: 'inventory-export-download',
    variant: 'success',
    title: 'The requested export is being downloaded.',
  });
