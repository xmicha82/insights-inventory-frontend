import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import validatorTypes from '@data-driven-forms/react-form-renderer/validator-types';
import componentTypes from '@data-driven-forms/react-form-renderer/component-types';
import Modal from './Modal';
import { deleteGroupsById, getGroupsByIds } from '../utils/api';
import {
  Backdrop,
  Bullseye,
  Button,
  Icon,
  Modal as PfModal,
  Spinner,
  Text,
} from '@patternfly/react-core';
import apiWithToast from '../utils/apiWithToast';
import { useDispatch } from 'react-redux';
import {
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
} from '@patternfly/react-icons';
import useFetchBatched from '../../../Utilities/hooks/useFetchBatched';

const generateSchema = (groups) => ({
  fields: [
    {
      component: componentTypes.PLAIN_TEXT,
      name: 'warning-message',
      label:
        groups.length > 1 ? (
          <Text>
            <strong>{groups.length}</strong> workspaces and all their data will
            be deleted.
          </Text>
        ) : (
          <Text>
            <strong>{groups[0]?.name}</strong> and all its data will be deleted.
          </Text>
        ),
    },
    {
      component: componentTypes.CHECKBOX,
      name: 'confirmation',
      label: 'I understand that this action cannot be undone.',
      validate: [{ type: validatorTypes.REQUIRED }],
    },
  ],
});

const generateContent = (groups = []) => ({
  title: groups.length > 1 ? 'Delete workspaces?' : 'Delete workspace?',
  titleIconVariant: () => (
    <Icon status="warning">
      <ExclamationTriangleIcon />
    </Icon>
  ),
  variant: 'danger',
  submitLabel: 'Delete',
  schema: generateSchema(groups),
});

const DeleteGroupModal = ({
  isModalOpen,
  setIsModalOpen,
  reloadData,
  groupIds,
}) => {
  const dispatch = useDispatch();
  const [fetchedGroups, setFetchedGroups] = useState(undefined);
  const groupsAreEmpty = (fetchedGroups || []).every(
    ({ host_count: hostCount }) => hostCount === 0,
  );
  const [isLoading, setIsLoading] = useState(true);
  const { fetchBatchedInline } = useFetchBatched();

  useEffect(() => {
    // check that all groups are empty before deletion
    let ignore = false;

    const verifyGroupsAreEmpty = async () => {
      const fetchedGroups = await fetchBatchedInline(getGroupsByIds, groupIds);

      if (!ignore) {
        setFetchedGroups(fetchedGroups.flatMap(({ results }) => results));
        setIsLoading(false);
      }

      // TODO: treat the error case
    };

    verifyGroupsAreEmpty();

    return () => {
      ignore = true;
    };
  }, []);

  const handleDeleteGroup = () => {
    const statusMessages = {
      onSuccess: {
        title: 'Success',
        description:
          groupIds.length > 1
            ? `${groupIds.length} workspaces deleted`
            : `${fetchedGroups?.[0]?.name} has been removed successfully`,
      },
      onError: {
        title: 'Error',
        description:
          groupIds.length > 1
            ? `Failed to delete ${groupIds.length} workspaces`
            : `Failed to delete workspace ${fetchedGroups?.[0]?.name}`,
      },
    };
    apiWithToast(dispatch, () => deleteGroupsById(groupIds), statusMessages);
  };

  return isLoading ? (
    <Backdrop>
      <Bullseye>
        <Spinner
          aria-label="Loading the modal spinner"
          aria-valueText="Loading..."
        />
      </Bullseye>
    </Backdrop>
  ) : !groupsAreEmpty ? ( // groups must have no systems to be deleted
    <PfModal
      variant="small"
      title={
        fetchedGroups.length > 1
          ? 'Cannot delete workspaces at this time'
          : 'Cannot delete workspace at this time'
      }
      titleIconVariant={() => (
        <Icon status="danger">
          <ExclamationCircleIcon />
        </Icon>
      )}
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      actions={[
        <Button
          key="close"
          variant="primary"
          onClick={() => setIsModalOpen(false)}
        >
          Close
        </Button>,
      ]}
    >
      {fetchedGroups.length > 1 ? (
        <Text>
          Workspaces containing systems cannot be deleted. To delete workspaces,
          first remove all of the systems from them.
        </Text>
      ) : (
        <Text>
          Workspaces containing systems cannot be deleted. To delete{' '}
          <strong>{fetchedGroups[0].name}</strong>, first remove all of the
          systems from it.
        </Text>
      )}
    </PfModal>
  ) : (
    <Modal
      isModalOpen={isModalOpen}
      closeModal={() => setIsModalOpen(false)}
      onSubmit={handleDeleteGroup}
      reloadData={reloadData}
      {...generateContent(fetchedGroups)}
    />
  );
};

DeleteGroupModal.propTypes = {
  groupIds: PropTypes.arrayOf(PropTypes.string).isRequired,
  isModalOpen: PropTypes.bool,
  setIsModalOpen: PropTypes.func,
  reloadData: PropTypes.func,
};
export default DeleteGroupModal;
