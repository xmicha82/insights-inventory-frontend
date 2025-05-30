import {
  CHIP,
  CHIP_GROUP,
  DROPDOWN_ITEM,
  MENU_ITEM,
  MENU_TOGGLE,
  PT_BULK_SELECT_CHECKBOX,
  PT_BULK_SELECT_LIST,
  MODAL_CONTENT,
  PAGINATION_CURRENT,
  PAGINATION_NEXT,
  PAGINATION_TOP,
  PAGINATION_VALUES,
  PRIMARY_TOOLBAR_ACTIONS,
  SORTING_ORDERS,
  TABLE_ROW,
  TOOLBAR,
  changePagination,
  checkEmptyState,
  checkPaginationTotal,
  checkPaginationValues,
  checkSelectedNumber,
  checkTableHeaders,
  hasChip,
  selectRowN,
} from '@redhat-cloud-services/frontend-components-utilities';
import _ from 'lodash';
import fixtures from '../../../cypress/fixtures/groups.json';
import { groupsInterceptors as interceptors } from '../../../cypress/support/interceptors';
import { ORDER_TO_URL } from '../../../cypress/support/utils';
import GroupsTable from './GroupsTable';

const DEFAULT_ROW_COUNT = 50;
const TABLE_HEADERS = ['Name', 'Total systems', 'Last modified'];
const SORTABLE_HEADERS = ['Name', 'Total systems', 'Last modified'];
const ROOT = 'div[id="groups-table"]';

const mountTable = (initialEntry = '/') =>
  cy.mountWithContext(GroupsTable, {
    routerProps: { initialEntries: [initialEntry], initialIndex: 0 },
  });

before(() => {
  cy.mockWindowInsights();
});

const waitTable = () =>
  cy
    .get('table[aria-label="Groups table"]')
    .should('have.attr', 'data-ouia-safe', 'true');

const checkSorting = (label, order, dataField) => {
  // get appropriate locators
  const header = `th[data-label="${label}"]`;
  if (order === 'ascending') {
    cy.get(header).find('button').click();
  } else {
    cy.get(header).find('button').click();
    cy.get(header).find('button').click();
  }

  cy.wait('@getGroups')
    .its('request.url')
    .should('include', `order_how=${ORDER_TO_URL[order]}`)
    .and('include', `order_by=${dataField}`);
};

const TEST_GROUP_NAME = 'Ut';
const TEST_GROUP_ID = 'bBEbFFB0D339fA46eD81cCA301d85AAF';

describe('test data', () => {
  it('first two rows do not have hosts', () => {
    expect(
      fixtures.results.slice(0, 2).every(({ host_count }) => host_count === 0),
    ).to.equal(true);
  });

  it('the third row has at least one host', () => {
    expect(fixtures.results[2].host_count > 0).to.equal(true);
  });

  it('at least one group has known host number', () => {
    expect(fixtures.results.some(({ host_count }) => host_count !== undefined));
  });

  it(`first group is ${TEST_GROUP_NAME}`, () => {
    expect(fixtures.results[0].id).to.equal(TEST_GROUP_ID);
    expect(fixtures.results[0].name).to.equal(TEST_GROUP_NAME);
  });
});

describe('renders correctly', () => {
  beforeEach(() => {
    interceptors['successful with some items'](); // comment out if the mock server is running
    mountTable();

    cy.wait('@getGroups'); // first initial call
  });

  it('the root container is rendered', () => {
    cy.get(ROOT).should('have.length', 1);
  });

  it('renders toolbar', () => {
    cy.get(TOOLBAR).should('have.length', 1);
  });

  it('renders table header', () => {
    checkTableHeaders(TABLE_HEADERS);
  });
});

describe('defaults', () => {
  beforeEach(() => {
    interceptors['successful with some items']();
    mountTable();

    cy.wait('@getGroups'); // first initial call
  });

  it(`pagination is set to ${DEFAULT_ROW_COUNT}`, () => {
    cy.get('.pf-v5-c-menu-toggle__text')
      .find('b')
      .eq(0)
      .should('have.text', `1 - ${DEFAULT_ROW_COUNT}`);
  });

  it('name filter is a default filter', () => {
    cy.ouiaId('name-filter').should('exist');
  });
});

describe('pagination', () => {
  beforeEach(() => {
    interceptors['successful with some items']();
    mountTable();

    cy.wait('@getGroups'); // first initial call
  });

  it('shows correct total number of groups', () => {
    checkPaginationTotal(fixtures.total);
  });

  it('values are expected ones', () => {
    checkPaginationValues(PAGINATION_VALUES);
  });

  it('can change page limit', () => {
    PAGINATION_VALUES.forEach((el) => {
      changePagination(el).then(() => {
        cy.wait('@getGroups')
          .its('request.url')
          .should('include', `per_page=${el}`);
      });
    });
  });

  it('can change page', () => {
    cy.get(PAGINATION_TOP).find(PAGINATION_NEXT).click(); // click "next page" button
    cy.wait('@getGroups').its('request.url').should('include', `page=2`);
  });
});

describe('url search parameters', () => {
  beforeEach(() => {
    interceptors['successful with some items']();
  });

  it('applies pagination', () => {
    mountTable('/?per_page=10&page=2');

    cy.wait('@getGroups')
      .its('request.url')
      .should('contain', 'per_page=10')
      .and('contain', 'page=2');
    cy.get(PAGINATION_TOP).find(MENU_TOGGLE).click();
    cy.get(PAGINATION_TOP)
      .find(MENU_ITEM)
      .contains('10 per page')
      .should('have.class', 'pf-m-selected');
    cy.get(PAGINATION_CURRENT).should('have.value', 2);
  });

  it('applies filters', () => {
    mountTable('/?name=123');

    cy.wait('@getGroups').its('request.url').should('contain', 'name=123');
    cy.get('.ins-c-primary-toolbar__filter')
      .find('input')
      .should('have.value', '123');
  });

  it('applies sorting, hosts count', () => {
    mountTable('/?order_by=host_count&order_how=desc');

    checkSorting('Total systems', 'descending', 'host_count');
  });

  it('applies sorting, last modified', () => {
    mountTable('/?order_by=host_count&order_how=desc');

    checkSorting('Last modified', 'descending', 'updated');
  });
});

describe('sorting', () => {
  beforeEach(() => {
    interceptors['successful with some items']();
    mountTable();

    cy.wait('@getGroups'); // first initial request
  });

  _.zip(['name', 'host_count', 'updated'], SORTABLE_HEADERS).forEach(
    ([category, label]) => {
      SORTING_ORDERS.forEach((order) => {
        it(`${order} by ${label}`, () => {
          checkSorting(label, order, category);
        });
      });
    },
  );
});

describe('filtering', () => {
  beforeEach(() => {
    interceptors['successful with some items']();
    mountTable();

    cy.wait('@getGroups'); // first initial request
  });

  const applyNameFilter = () =>
    cy.get('.ins-c-primary-toolbar__filter').find('input').type('lorem');
  it('renders filter chip', () => {
    applyNameFilter();
    hasChip('Name', 'lorem');
    cy.wait('@getGroups');
  });

  it('sends correct request', () => {
    applyNameFilter();
    cy.wait('@getGroups').its('request.url').should('include', 'name=lorem');
  });

  it('can remove the chip or reset filters', () => {
    applyNameFilter();
    cy.wait('@getGroups').its('request.url').should('contain', 'name=lorem');
    cy.get(CHIP_GROUP)
      .find(CHIP)
      .ouiaId('close', 'button')
      .each(() => {
        cy.get(CHIP_GROUP).find(CHIP).ouiaId('close', 'button');
      });
    cy.get('button').contains('Reset filters').click();
    cy.wait('@getGroups').its('request.url').should('not.contain', 'name');
    cy.get(CHIP_GROUP).should('not.exist');
  });
});

describe('selection and bulk selection', () => {
  beforeEach(() => {
    interceptors['successful with some items'](); // comment out if the mock server is running
    interceptors['successful with some items second page']();
    mountTable();

    cy.wait('@getGroups'); // first initial request
  });

  it('can select and deselect groups', () => {
    const middleRow = Math.ceil(DEFAULT_ROW_COUNT / 2);
    selectRowN(middleRow);
    checkSelectedNumber(1);
    selectRowN(Math.ceil(middleRow / 2));
    checkSelectedNumber(2);
    selectRowN(middleRow);
    checkSelectedNumber(1);
  });

  it('can select all in dropdown toggle', () => {
    cy.get(
      '.pf-v5-c-toolbar__group > :nth-child(1) > .pf-v5-c-menu-toggle',
    ).click(); // open selection dropdown
    cy.get(DROPDOWN_ITEM).contains('Select all').click();
    checkSelectedNumber(fixtures.total);
  });

  it('can select all by clicking checkbox', () => {
    cy.get(PT_BULK_SELECT_CHECKBOX).click();
    checkSelectedNumber(fixtures.total);
    cy.get(PT_BULK_SELECT_CHECKBOX).click();
    checkSelectedNumber(0);
  });

  it('can select none', () => {
    selectRowN(1);
    cy.get(
      '.pf-v5-c-toolbar__group > :nth-child(1) > .pf-v5-c-menu-toggle > .pf-v5-c-menu-toggle__controls',
    ).click();
    cy.get(PT_BULK_SELECT_LIST).find(MENU_ITEM).eq(1).click();
    checkSelectedNumber(0);
  });
});

describe('actions', () => {
  beforeEach(() => {
    interceptors['successful with some items']();
    mountTable();

    cy.wait('@getGroups'); // first initial request
  });

  const TEST_ID = 0;

  it('bulk delete action is disabled when no items selected', () => {
    cy.get(PRIMARY_TOOLBAR_ACTIONS).click();
    cy.get(DROPDOWN_ITEM).contains('Delete workspace').shouldHaveAriaDisabled();
  });

  describe('deletion', () => {
    beforeEach(() => {
      const fixturesOneGroup = _.cloneDeep(fixtures);
      fixturesOneGroup.results = fixturesOneGroup.results.slice(0, 1);
      interceptors['successful with some items'](fixturesOneGroup);
    });

    it('can delete a group, 1', () => {
      cy.get(TABLE_ROW)
        .eq(TEST_ID + 1)
        .find(MENU_TOGGLE)
        .click();
      cy.get(MENU_ITEM).contains('Delete workspace').click();
      cy.get(MODAL_CONTENT)
        .find('h1')
        .should('contain.text', 'Delete workspace?');
      cy.get(MODAL_CONTENT)
        .find('p')
        .should(
          'contain.text',
          `${fixtures.results[TEST_ID].name} and all its data will be deleted.`,
        );
    });

    it('can delete a group, 2', () => {
      selectRowN(TEST_ID + 1);
      cy.get(PRIMARY_TOOLBAR_ACTIONS).click();
      cy.get(DROPDOWN_ITEM).contains('Delete workspace').click();
      cy.get(MODAL_CONTENT)
        .find('h1')
        .should('contain.text', 'Delete workspace?');
      cy.get(MODAL_CONTENT)
        .find('p')
        .should(
          'contain.text',
          `${fixtures.results[TEST_ID].name} and all its data will be deleted.`,
        );
    });

    it('cannot delete a non-empty group', () => {
      const fixturesOneGroup = _.cloneDeep(fixtures);
      fixturesOneGroup.results = fixturesOneGroup.results.slice(2, 3);
      interceptors['successful with some items'](fixturesOneGroup);

      selectRowN(3);
      cy.get(PRIMARY_TOOLBAR_ACTIONS).click();
      cy.get(DROPDOWN_ITEM).contains('Delete workspace').click();
      cy.get(MODAL_CONTENT)
        .find('h1')
        .should('contain.text', 'Cannot delete workspace at this time');
    });

    it('can delete more groups', () => {
      const fixturesTwoGroups = _.cloneDeep(fixtures);
      fixturesTwoGroups.results = fixturesTwoGroups.results.slice(0, 2);
      interceptors['successful with some items'](fixturesTwoGroups);

      const TEST_ROWS = [1, 2];
      TEST_ROWS.forEach((row) => selectRowN(row));

      cy.get(PRIMARY_TOOLBAR_ACTIONS).click();
      cy.get(DROPDOWN_ITEM).contains('Delete workspaces').click();
      cy.get(MODAL_CONTENT)
        .find('h1')
        .should('contain.text', 'Delete workspaces?');
      cy.get(MODAL_CONTENT)
        .find('p')
        .should(
          'contain.text',
          `${TEST_ROWS.length} workspaces and all their data will be deleted.`,
        );
    });

    it('cannot delete workspaces if at least one is not empty', () => {
      const fixturesThreeGroups = _.cloneDeep(fixtures);
      fixturesThreeGroups.results = fixturesThreeGroups.results.slice(0, 3);
      interceptors['successful with some items'](fixturesThreeGroups);

      const TEST_ROWS = [1, 2, 3];
      TEST_ROWS.forEach((row) => selectRowN(row));

      cy.get(PRIMARY_TOOLBAR_ACTIONS).click();
      cy.get(DROPDOWN_ITEM).contains('Delete workspaces').click();
      cy.get(MODAL_CONTENT)
        .find('h1')
        .should('contain.text', 'Cannot delete workspaces at this time');
    });
  });

  it('can create a group', () => {
    cy.get(TOOLBAR)
      .find('button')
      .contains('Create workspace')
      .shouldHaveAriaEnabled();
  });
});

describe('edge cases', () => {
  it('no groups match', () => {
    interceptors['successful empty']();
    mountTable();

    cy.wait('@getGroups').then(() => {
      checkEmptyState('No matching workspaces found', true);
      checkPaginationTotal(0);
    });
  });

  it('failed request', () => {
    interceptors['failed with server error']();
    mountTable();

    cy.wait('@getGroups').then(() => {
      cy.get('.pf-v5-c-empty-state')
        .find('h4')
        .contains('Something went wrong');
      // the filter is disabled
      cy.ouiaId('name-filter').find('input').should('have.attr', 'disabled');
      cy.ouiaId('pager').find('button').should('have.attr', 'disabled');
    });
  });
});

describe('integration with rbac', () => {
  describe('with only groups read', () => {
    before(() => {
      cy.mockWindowInsights({ userPermissions: ['inventory:groups:read'] });
    });

    beforeEach(() => {
      interceptors['successful with some items'](); // comment out if the mock server is running
      mountTable();
      waitTable();
    });

    it('disables general actions', () => {
      cy.get(TOOLBAR)
        .find('button')
        .contains('Create workspace')
        .shouldHaveAriaDisabled();

      cy.get(PRIMARY_TOOLBAR_ACTIONS).click();
      cy.get(DROPDOWN_ITEM)
        .contains('Delete workspace')
        .shouldHaveAriaDisabled();
    });

    it('disables per-row actions', () => {
      cy.get(TABLE_ROW).eq(0).find(MENU_TOGGLE).click();
      cy.get(MENU_ITEM).contains('Delete workspace').shouldHaveAriaDisabled();
    });
  });

  describe('with the write permissions for some groups', () => {
    before(() => {
      cy.mockWindowInsights({
        userPermissions: [
          'inventory:groups:read',
          {
            permission: 'inventory:groups:write',
            resourceDefinitions: [
              {
                attributeFilter: {
                  key: 'group.id',
                  operation: 'equal',
                  value: TEST_GROUP_ID,
                },
              },
            ],
          },
        ],
      });
    });

    beforeEach(() => {
      interceptors['successful with some items'](); // comment out if the mock server is running
      mountTable();
      waitTable();
    });

    it('has actions enabled for permitted group', () => {
      cy.get(TABLE_ROW).eq(0).find(MENU_TOGGLE).click();
      cy.get(DROPDOWN_ITEM)
        .contains('Rename workspace')
        .shouldNotHaveAriaDisabled();
      cy.get(DROPDOWN_ITEM)
        .contains('Delete workspace')
        .shouldNotHaveAriaDisabled();
    });

    it('has actions disabled for another group', () => {
      cy.get(TABLE_ROW).eq(1).find(MENU_TOGGLE).click();
      cy.get(DROPDOWN_ITEM)
        .contains('Rename workspace')
        .shouldHaveAriaDisabled();
      cy.get(DROPDOWN_ITEM)
        .contains('Delete workspace')
        .shouldHaveAriaDisabled();
    });

    it('should allow to bulk delete permitted groups', () => {
      selectRowN(0);
      cy.get(PRIMARY_TOOLBAR_ACTIONS).click();
      cy.get(DROPDOWN_ITEM)
        .contains('Delete workspace')
        .shouldNotHaveAriaDisabled();
    });

    it('cannot bulk delete if restricted group selected', () => {
      selectRowN(0);
      selectRowN(1);
      cy.get(PRIMARY_TOOLBAR_ACTIONS).click();
      cy.get(DROPDOWN_ITEM)
        .contains('Delete workspace')
        .shouldHaveAriaDisabled();
    });
  });
});
