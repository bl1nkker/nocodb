import { test } from '@playwright/test';
import { DashboardPage } from '../../pages/Dashboard';
import setup from '../../setup';
import { FormPage } from '../../pages/Dashboard/Form';
import { SharedFormPage } from '../../pages/SharedForm';
import { AccountPage } from '../../pages/Account';
import { AccountAppStorePage } from '../../pages/Account/AppStore';
import { Api, UITypes } from 'nocodb-sdk';
let api: Api<any>;

// todo: Move most of the ui actions to page object and await on the api response
test.describe('Form view', () => {
  let dashboard: DashboardPage;
  let form: FormPage;
  let accountAppStorePage: AccountAppStorePage;
  let accountPage: AccountPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.project);
    form = dashboard.form;
    accountPage = new AccountPage(page);
    accountAppStorePage = accountPage.appStore;
  });

  test('Field re-order operations', async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'Country' });

    await dashboard.viewSidebar.createFormView({ title: 'CountryForm' });
    await dashboard.viewSidebar.verifyView({ title: 'CountryForm', index: 1 });

    // verify form-view fields order
    await form.verifyFormViewFieldsOrder({
      fields: ['Country', 'LastUpdate', 'City List'],
    });

    // reorder & verify
    await form.reorderFields({
      sourceField: 'LastUpdate',
      destinationField: 'Country',
    });
    await form.verifyFormViewFieldsOrder({
      fields: ['LastUpdate', 'Country', 'City List'],
    });

    // remove & verify (drag-drop)
    await form.removeField({ field: 'City List', mode: 'dragDrop' });
    await form.verifyFormViewFieldsOrder({
      fields: ['LastUpdate', 'Country'],
    });

    // add & verify (drag-drop)
    await form.addField({ field: 'City List', mode: 'dragDrop' });
    await form.verifyFormViewFieldsOrder({
      fields: ['LastUpdate', 'Country', 'City List'],
    });

    // remove & verify (hide field button)
    await form.removeField({ field: 'City List', mode: 'hideField' });
    await form.verifyFormViewFieldsOrder({
      fields: ['LastUpdate', 'Country'],
    });

    // add & verify (hide field button)
    await form.addField({ field: 'City List', mode: 'clickField' });
    await form.verifyFormViewFieldsOrder({
      fields: ['LastUpdate', 'Country', 'City List'],
    });

    // remove-all & verify
    await form.removeAllFields();
    await dashboard.rootPage.waitForTimeout(2000);
    await form.verifyFormViewFieldsOrder({
      fields: ['Country'],
    });

    // // add-all & verify
    await form.addAllFields();
    await dashboard.rootPage.waitForTimeout(2000);
    await form.verifyFormViewFieldsOrder({
      fields: ['LastUpdate', 'Country', 'City List'],
    });
  });

  test('Form elements validation', async ({ page }) => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'Country' });

    await dashboard.viewSidebar.createFormView({ title: 'CountryForm' });
    await dashboard.viewSidebar.verifyView({ title: 'CountryForm', index: 1 });

    await form.configureHeader({
      title: 'Country',
      subtitle: 'Country subtitle',
    });
    await form.verifyHeader({
      title: 'Country',
      subtitle: 'Country subtitle',
    });

    // configure field title & description
    await form.configureField({
      field: 'Country',
      label: 'Country new title',
      helpText: 'Country new description',
      required: true,
    });
    await form.verifyFormFieldLabel({
      index: 0,
      label: 'Country new title',
    });
    await form.verifyFormFieldHelpText({
      index: 0,
      helpText: 'Country new description',
    });

    // revert configurations
    await form.configureField({
      field: 'Country',
      label: 'Country',
      helpText: '',
      required: true,
    });

    // retain only 'Country' field
    await form.removeAllFields();

    // submit default form validation
    await form.fillForm([{ field: 'Country', value: '_abc' }]);
    await form.submitForm();
    await form.verifyStatePostSubmit({
      message: 'Successfully submitted form data',
    });

    // submit custom form validation
    await dashboard.viewSidebar.openView({ title: 'CountryForm' });
    await form.configureSubmitMessage({
      message: 'Custom submit message',
    });
    await form.fillForm([{ field: 'Country', value: '_abc' }]);
    await form.submitForm();
    await form.verifyStatePostSubmit({
      message: 'Custom submit message',
    });

    // enable 'submit another form' option
    await dashboard.viewSidebar.openView({ title: 'CountryForm' });
    await form.showAnotherFormRadioButton.click();
    await form.fillForm([{ field: 'Country', value: '_abc' }]);
    await form.submitForm();
    await dashboard.rootPage.waitForTimeout(2000);
    await form.verifyStatePostSubmit({
      submitAnotherForm: true,
    });
    await form.submitAnotherForm().click();

    // enable 'show another form' option
    await form.showAnotherFormRadioButton.click();
    await form.showAnotherFormAfter5SecRadioButton.click();
    await form.fillForm([{ field: 'Country', value: '_abc' }]);
    await form.fillForm([{ field: 'Country', value: '_abc' }]);
    await form.submitForm();
    await dashboard.rootPage.waitForTimeout(6000);
    await form.verifyStatePostSubmit({
      showBlankForm: true,
    });

    // enable 'email-me' option
    await form.showAnotherFormAfter5SecRadioButton.click();
    await form.emailMeRadioButton.click();
    await dashboard.verifyToast({
      message: 'Please activate SMTP plugin in App store for enabling email notification',
    });
    const url = dashboard.rootPage.url();

    // activate SMTP plugin
    await accountAppStorePage.goto();

    // install SMTP
    await accountAppStorePage.install({ name: 'SMTP' });
    await accountAppStorePage.configureSMTP({
      email: 'a@b.com',
      host: 'smtp.gmail.com',
      port: '587',
    });
    await dashboard.verifyToast({
      message: 'Successfully installed and email notification will use SMTP configuration',
    });

    // revisit form view
    await page.goto(url);

    // enable 'email-me' option
    await dashboard.viewSidebar.openView({ title: 'CountryForm' });
    await form.emailMeRadioButton.click();
    await form.verifyAfterSubmitMenuState({
      emailMe: true,
      submitAnotherForm: false,
      showBlankForm: false,
    });

    // Uninstall SMTP
    await accountAppStorePage.goto();
    await accountAppStorePage.uninstall({ name: 'SMTP' });

    await dashboard.verifyToast({
      message: 'Plugin uninstalled successfully',
    });
  });

  test('Form share, verify attachment file', async () => {
    await dashboard.treeView.createTable({ title: 'New' });

    await dashboard.grid.column.create({
      title: 'Attachment',
      type: 'Attachment',
    });

    await dashboard.viewSidebar.createFormView({ title: 'NewForm' });
    await dashboard.form.toolbar.clickShareView();
    const formLink = await dashboard.form.toolbar.shareView.getShareLink();

    await dashboard.rootPage.goto(formLink);

    const sharedForm = new SharedFormPage(dashboard.rootPage);
    await sharedForm.cell.attachment.addFile({
      columnHeader: 'Attachment',
      filePath: `${process.cwd()}/fixtures/sampleFiles/sampleImage.jpeg`,
    });
    await sharedForm.cell.fillText({
      columnHeader: 'Title',
      text: 'Text',
    });

    await sharedForm.submit();
    await sharedForm.verifySuccessMessage();
  });
});

test.describe('Form view with LTAR', () => {
  let dashboard: DashboardPage;
  let form: FormPage;
  let context: any;

  let cityTable: any, countryTable: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.project);
    form = dashboard.form;

    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });

    const cityColumns = [
      {
        column_name: 'Id',
        title: 'Id',
        uidt: UITypes.ID,
      },
      {
        column_name: 'City',
        title: 'City',
        uidt: UITypes.SingleLineText,
        pv: true,
      },
    ];
    const countryColumns = [
      {
        column_name: 'Id',
        title: 'Id',
        uidt: UITypes.ID,
      },
      {
        column_name: 'Country',
        title: 'Country',
        uidt: UITypes.SingleLineText,
        pv: true,
      },
    ];

    try {
      const project = await api.project.read(context.project.id);
      cityTable = await api.base.tableCreate(context.project.id, project.bases?.[0].id, {
        table_name: 'City',
        title: 'City',
        columns: cityColumns,
      });
      countryTable = await api.base.tableCreate(context.project.id, project.bases?.[0].id, {
        table_name: 'Country',
        title: 'Country',
        columns: countryColumns,
      });

      const cityRowAttributes = [{ City: 'Atlanta' }, { City: 'Pune' }, { City: 'London' }, { City: 'Sydney' }];
      await api.dbTableRow.bulkCreate('noco', context.project.id, cityTable.id, cityRowAttributes);

      const countryRowAttributes = [{ Country: 'India' }, { Country: 'UK' }, { Country: 'Australia' }];
      await api.dbTableRow.bulkCreate('noco', context.project.id, countryTable.id, countryRowAttributes);

      // create LTAR Country has-many City
      await api.dbTableColumn.create(countryTable.id, {
        column_name: 'CityList',
        title: 'CityList',
        uidt: UITypes.LinkToAnotherRecord,
        parentId: countryTable.id,
        childId: cityTable.id,
        type: 'hm',
      });

      // await api.dbTableRow.nestedAdd('noco', context.project.id, countryTable.id, '1', 'hm', 'CityList', '1');
    } catch (e) {
      console.log(e);
    }

    // reload page after api calls
    await page.reload();
  });

  test('Form view with LTAR', async () => {
    await dashboard.treeView.openTable({ title: 'Country' });

    const url = dashboard.rootPage.url();

    await dashboard.viewSidebar.createFormView({ title: 'NewForm' });
    await dashboard.form.toolbar.clickShareView();
    const formLink = await dashboard.form.toolbar.shareView.getShareLink();

    await dashboard.rootPage.goto(formLink);

    const sharedForm = new SharedFormPage(dashboard.rootPage);
    await sharedForm.cell.fillText({
      columnHeader: 'Country',
      text: 'USA',
    });
    await sharedForm.clickLinkToChildList();
    await sharedForm.verifyChildList(['Atlanta', 'Pune', 'London', 'Sydney']);
    await sharedForm.selectChildList('Atlanta');

    await sharedForm.submit();
    await sharedForm.verifySuccessMessage();

    await dashboard.rootPage.goto(url);
    await dashboard.viewSidebar.openView({ title: 'Country' });

    await dashboard.grid.cell.verify({
      index: 3,
      columnHeader: 'Country',
      value: 'USA',
    });
    await dashboard.grid.cell.verifyVirtualCell({
      index: 3,
      columnHeader: 'CityList',
      count: 1,
      value: ['Atlanta'],
    });
  });
});
