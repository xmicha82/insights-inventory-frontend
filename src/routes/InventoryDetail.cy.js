import {
  edgeInterceptors,
  featureFlagsInterceptors,
  hostsDetailInterceptors,
  hostsDetailTagsInterceptors,
  systemProfileInterceptors,
} from '../../cypress/support/interceptors';
import InventoryDetail from './InventoryDetail';
import hostDetail from '../../cypress/fixtures/hostDetail.json';
import _ from 'lodash';
import { TEXT_INPUT } from '@redhat-cloud-services/frontend-components-utilities';

const mountWithProps = (options, props = {}) =>
  cy.mountWithContext(InventoryDetail, options, props);

const waitForLoad = () => {
  cy.get('.ins-c-inventory-detail__app-tabs')
    .contains('General information')
    .click();
  cy.ouiaId('Host name value').should('have.text', hostDetail.results[0].fqdn);
};
const prepareTest = (hostDetail = hostDetail) => {
  featureFlagsInterceptors.successful();
  edgeInterceptors.successful();
  systemProfileInterceptors['full system profile, successful with response']();
  hostsDetailInterceptors.successful(hostDetail);
  hostsDetailTagsInterceptors.successful();

  mountWithProps({
    path: '/inventory/:inventoryId',
    routerProps: { initialEntries: ['/inventory/test-host-id'] },
  });

  waitForLoad();
};

const hostInGroup = _.cloneDeep(hostDetail);
hostInGroup.results[0].groups = [
  {
    id: 'group-a-id',
    name: 'group-a-name',
  },
];
hostInGroup.results[0].system_profile.operating_system.name = 'RHEL';

describe('renders correctly', () => {
  before(() => cy.mockWindowInsights());
  beforeEach(() => prepareTest(hostInGroup));

  it('renders main components for edge host', () => {
    cy.get('.ins-entity-detail').should('have.length', 1);

    cy.get('[data-cy="patch-tab"]')
      .parent('.pf-v5-c-tabs__item.pf-m-disabled')
      .should('have.length', 1);
    cy.get('[data-cy="compliance-tab"]')
      .parent('.pf-v5-c-tabs__item.pf-m-disabled')
      .should('have.length', 1);
    cy.get('[data-cy="vulnerabilities-tab"]')
      .parent('.pf-v5-c-tabs__item')
      .should('have.length', 1);

    // TODO: add more checks other for handling edge hosts
  });
});

describe('rbac integration', () => {
  describe('with no permissions', () => {
    before(() => cy.mockWindowInsights({ userPermissions: [] }));
    beforeEach(() => prepareTest(hostInGroup));

    it('should disable delete and edit buttons', () => {
      cy.contains('Delete')
        .should('exist')
        .and('have.attr', 'aria-disabled', 'true');
    });

    it('should disable edit buttons', () => {
      cy.ouiaId('Display name value')
        .find('[aria-label="Edit"]')
        .should('exist')
        .and('have.attr', 'aria-disabled', 'true');
      cy.ouiaId('Ansible hostname value')
        .find('[aria-label="Edit"]')
        .should('exist')
        .and('have.attr', 'aria-disabled', 'true');
    });
  });

  describe('with write permissions limited by group', () => {
    before(() =>
      cy.mockWindowInsights({
        userPermissions: [
          {
            permission: 'inventory:hosts:write',
            resourceDefinitions: [
              {
                attributeFilter: {
                  key: 'group.id',
                  operation: 'equal',
                  value: 'group-a-id',
                },
              },
            ],
          },
        ],
      }),
    );
    beforeEach(() => prepareTest(hostInGroup));

    it('should enable delete and edit buttons', () => {
      cy.contains('Delete').should('exist').and('be.enabled');
    });

    it('should enable edit buttons', () => {
      cy.ouiaId('Display name value').find('[aria-label="Edit"]').click();
      cy.get(TEXT_INPUT).first().should('have.value', 'host-1');
      cy.ouiaId('Ansible hostname value').find('[aria-label="Edit"]').click();
      cy.get(TEXT_INPUT).last().should('have.value', 'fqdn-1');
    });
  });

  describe('with excluding group permissions', () => {
    before(() =>
      cy.mockWindowInsights({
        userPermissions: [
          {
            permission: 'inventory:hosts:write',
            resourceDefinitions: [
              {
                attributeFilter: {
                  key: 'group.id',
                  operation: 'equal',
                  //ask about this value
                  value: 'group-a-id',
                },
              },
            ],
          },
        ],
      }),
    );

    beforeEach(() => prepareTest(hostInGroup));

    it('should enable delete and edit buttons', () => {
      cy.contains('Delete').should('exist').and('be.enabled');
    });

    it('should enable edit buttons', () => {
      cy.ouiaId('Display name value').find('[aria-label="Edit"]').click();
      cy.get(TEXT_INPUT).first().should('have.value', 'host-1');
      cy.ouiaId('Ansible hostname value').find('[aria-label="Edit"]').click();
      cy.get(TEXT_INPUT).last().should('have.value', 'fqdn-1');
    });
  });
});
