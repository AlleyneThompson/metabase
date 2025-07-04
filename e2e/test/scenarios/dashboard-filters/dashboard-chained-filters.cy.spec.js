const { H } = cy;
import { WRITABLE_DB_ID } from "e2e/support/cypress_data";
import { SAMPLE_DATABASE } from "e2e/support/cypress_sample_database";
import { ORDERS_DASHBOARD_ID } from "e2e/support/cypress_sample_instance_data";

const { PEOPLE } = SAMPLE_DATABASE;

describe("scenarios > dashboard > chained filter", () => {
  beforeEach(() => {
    H.restore();
    cy.signInAsAdmin();
  });

  for (const has_field_values of ["search", "list"]) {
    it(`limit ${has_field_values} options based on linked filter`, () => {
      cy.request("PUT", `/api/field/${PEOPLE.CITY}`, { has_field_values }),
        H.visitDashboard(ORDERS_DASHBOARD_ID);

      H.editDashboard();

      // add a state filter
      H.setFilter("Location", "Is", "Location");

      // connect that to people.state
      H.getDashboardCard().within(() => {
        cy.findByText("Column to filter on");
        cy.findByText("Select…").click();
      });

      H.popover().within(() => {
        cy.findByText("State").click();
      });

      // open the linked filters tab, and click the click to add a City filter
      cy.findAllByRole("tab").contains("Linked filters").click();

      cy.findByRole("tabpanel")
        .findByText("add another dashboard filter")
        .click();

      H.popover().findByText("Location").click();

      H.sidebar().findByText("Filter operator").next().click();
      H.selectDropdown().findByText("Is").click();

      // connect that to person.city
      H.getDashboardCard().within(() => {
        cy.findByText("Column to filter on");
        cy.findByText("Select…").click();
      });
      H.popover().within(() => {
        cy.findByText("City").click();
      });

      cy.findAllByRole("tab").contains("Linked filters").click();
      // Link city to state
      cy.findByRole("tabpanel").within(() => {
        // turn on the switch, input has 0 width and height
        cy.findByRole("switch").parent().get("label").click();

        // open up the list of linked columns
        cy.findByText("Location").click();
        // It's hard to assert on the "table.column" pairs.
        // We just assert that the headers are there to know that something appeared.
        cy.findByText("Filtering column");
        cy.findByText("Filtered column");
      });

      H.saveDashboard();

      // now test that it worked!
      // Select Alaska as a state. We should see Anchorage as a option but not Anacoco
      H.filterWidget().contains("Location").click();

      cy.findByPlaceholderText(/search the list/i).should("be.visible");

      H.popover().within(() => {
        cy.findByText("AK").click();
        cy.findByText("Add filter").click();
      });

      H.filterWidget().contains("Location 1").click();

      H.dashboardParametersPopover().within(() => {
        if (has_field_values === "search") {
          H.fieldValuesCombobox().type("An");
        }
        if (has_field_values === "list") {
          cy.findByPlaceholderText("Search the list").type("An");
        }
      });

      const valuesWidget = () =>
        has_field_values === "search"
          ? cy.findByRole("listbox")
          : cy.findByTestId("field-values-widget");

      valuesWidget().within(() => {
        cy.findByText("Anchorage").should("exist");
        cy.findByText("Anacoco").should("not.exist");
      });

      cy.findByTestId("parameter-value-dropdown").within(() => {
        if (has_field_values === "search") {
          H.fieldValuesCombobox()
            .type("{backspace}{backspace}")
            // close the suggestion list
            .blur();
        }
        if (has_field_values === "list") {
          cy.findByPlaceholderText("Search the list").clear();
        }
      });

      H.filterWidget().contains("AK").click();

      // eslint-disable-next-line no-unsafe-element-filtering
      H.popover()
        .last()
        .within(() => {
          cy.findByText("AK").click();
          cy.findByText("GA").click();

          cy.findByText("Update filter").click();
        });

      // do it again to make sure it isn't cached incorrectly
      H.filterWidget().contains("Location 1").click();
      cy.findByTestId("parameter-value-dropdown").within(() => {
        if (has_field_values === "search") {
          H.fieldValuesCombobox().type("An");
        }
        if (has_field_values === "list") {
          cy.findByPlaceholderText("Search the list").type("An");
        }
      });

      valuesWidget().within(() => {
        cy.findByText("Canton");
        cy.findByText("Anchorage").should("not.exist");
      });

      if (has_field_values === "search") {
        cy.findByTestId("parameter-value-dropdown").within(() => {
          // close the suggestion list
          H.fieldValuesCombobox().blur();
        });
      }

      H.filterWidget().contains("GA").click();
      // eslint-disable-next-line no-unsafe-element-filtering
      H.popover()
        .last()
        .within(() => {
          cy.findByText("GA").click();
          cy.findByText("Update filter").click();
        });

      // do it again without a state filter to make sure it isn't cached incorrectly
      H.filterWidget().contains("Location 1").click();
      cy.findByTestId("parameter-value-dropdown").within(() => {
        if (has_field_values === "search") {
          H.fieldValuesCombobox().type("An");
        }
        if (has_field_values === "list") {
          cy.findByRole("combobox").type("An");
        }
      });

      valuesWidget().within(() => {
        cy.findByText("Adrian");
        cy.findByText("Anchorage");
        cy.findByText("Canton");
      });
    });
  }

  it(
    "should work for all field types (metabase#15170)",
    { tags: "@external" },

    () => {
      const dialect = "postgres";
      const TEST_TABLE = "many_data_types";

      H.restore(`${dialect}-writable`);
      H.resetTestTable({ type: dialect, table: TEST_TABLE });
      cy.signInAsAdmin();
      H.resyncDatabase({ tableName: TEST_TABLE, tableAlias: "testTable" });

      cy.get("@testTable").then((testTable) => {
        const testTableId = testTable.id;
        const uuidFieldId = testTable.fields.find(
          (field) => field.name === "uuid",
        ).id;
        const idFieldId = testTable.fields.find(
          (field) => field.name === "id",
        ).id;

        cy.wrap(testTableId).as("testTableId");
        cy.wrap(uuidFieldId).as("uuidFieldId");

        cy.log(
          "Mimics that UUID is the table's primary key, so we could map dashboard ID parameter to UUID",
        );
        cy.request("PUT", `/api/field/${idFieldId}`, {
          semantic_type: null,
        });

        cy.request("PUT", `/api/field/${uuidFieldId}`, {
          semantic_type: "type/PK",
        });
      });

      cy.then(function () {
        const TEST_TABLE_ID = this.testTableId;
        const UUID_FIELD_ID = this.uuidFieldId;

        H.createQuestion({
          name: "15170",
          database: WRITABLE_DB_ID,
          query: { "source-table": TEST_TABLE_ID },
        }).then(({ body: { id: QUESTION_ID } }) => {
          H.createDashboard().then(({ body: { id: DASHBOARD_ID } }) => {
            // Add filter to the dashboard
            cy.request("PUT", `/api/dashboard/${DASHBOARD_ID}`, {
              parameters: [
                {
                  id: "50c9eac6",
                  name: "ID",
                  slug: "id",
                  type: "id",
                },
              ],
            });

            // Add previously created question to the dashboard
            H.addOrUpdateDashboardCard({
              card_id: QUESTION_ID,
              dashboard_id: DASHBOARD_ID,
            }).then(({ body: { id: DASH_CARD_ID } }) => {
              // Connect filter to that question
              cy.request("PUT", `/api/dashboard/${DASHBOARD_ID}`, {
                dashcards: [
                  {
                    id: DASH_CARD_ID,
                    card_id: QUESTION_ID,
                    row: 0,
                    col: 0,
                    size_x: 11,
                    size_y: 6,
                    parameter_mappings: [
                      {
                        parameter_id: "50c9eac6",
                        card_id: QUESTION_ID,
                        target: ["dimension", ["field-id", UUID_FIELD_ID]],
                      },
                    ],
                  },
                ],
              });
            });

            H.visitDashboard(DASHBOARD_ID);
            cy.icon("pencil").click();
            H.showDashboardCardActions();
            H.getDashboardCard().icon("click").click();
            cy.findByText("UUID").click();
            cy.findByText("Update a dashboard filter").click();
            cy.findByText("Available filters")
              .parent()
              .findByText("ID")
              .click();
            H.popover().findByText("UUID").should("be.visible");
          });
        });
      });
    },
  );
});
