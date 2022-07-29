// utils
const zipObject = (props, values) => {
  return props.reduce((prev, prop, i) => {
    return Object.assign(prev, { [prop]: values[i] });
  }, {});
};

const baseName = (path) => {
  return String(path).substring(path.lastIndexOf('/') + 1);
};

class GithubRepository {
  constructor() {
    this.url = new URL(window.location);
    const [, nameWithOwner, , branch] = this.url.pathname.match(/\/(.+)\/compare\/(.+\.\.\.)?(.+)/);
    this.nameWithOwner = nameWithOwner;
    this.branch = branch;
    this.defaultTemplate = 'default';
    this.project = 'pr-templates';
    this.localStoragePath = `${this.nameWithOwner}:${this.project}`;
    this.localStoragePathFull = `ref-selector:${this.localStoragePath}:tag`;
    this.cacheKey = this.project;
    this.baseURL = `https://github.com/${this.nameWithOwner}`;
    this.currentCommittish = this.url.searchParams.get('template') || 'default';
    this.templates = {};
  }

  attachDropdown = () => {
    Promise.resolve()
      .then(() => this.loadTemplates())
      .then(() => this.fetchExtensionHtml('dropdown.html'))
      .then(this.generateDropdown)
      .then(this.insertDropdown)
      .then(this.activateDropdown)
      .catch(console.error);
  };

  loadTemplates = () => {
    return Promise.all([this.fetchDefaultTemplate(), this.fetchCustomTemplates()]).then(
      ([defaultTemplate, customTemplates]) => {
        this.templates['default'] = defaultTemplate;
        Object.assign(this.templates, customTemplates);
        const refs = Object.keys(this.templates);

        localStorage.setItem(
          this.localStoragePathFull,
          JSON.stringify({ refs, cacheKey: this.cacheKey }),
        );
      },
    );
  };

  fetchDefaultTemplate = () => {
    return this.fetchTemplate('pull_request_template.md');
  };

  fetchCustomTemplates = () => {
    return this.fetchGithub(`/tree/${this.branch}/.github/PULL_REQUEST_TEMPLATE`).then((html) => {
      const regex = new RegExp(/href=".+(PULL_REQUEST_TEMPLATE\/.+\.md)"/g);
      const templateUrls = [...html.matchAll(regex)].map((match) => match[1]);
      const templateBaseNames = templateUrls.map(baseName);

      return Promise.all(templateUrls.map(this.fetchTemplate)).then((templates) =>
        zipObject(templateBaseNames, templates),
      );
    });
  };

  fetchGithub = (path) => {
    return fetch(`${this.baseURL}${path}`, { credentials: 'same-origin' }).then((res) =>
      res.text(),
    );
  };

  fetchTemplate = (path) => {
    return this.fetchGithub(`/raw/${this.branch}/.github/${path}`);
  };

  fetchExtensionHtml = (path) => {
    return fetch(chrome.runtime.getURL(path)).then((response) => response.text());
  };

  generateDropdown = (dropdownTemplate) => {
    return dropdownTemplate
      .replace('{{default-template}}', this.defaultTemplate)
      .replace('{{default-template64}}', btoa(this.defaultTemplate))
      .replace('{{name-with-owner64}}', btoa(this.localStoragePath))
      .replace('{{current-committish}}', this.currentCommittish)
      .replace('{{current-committish64}}', btoa(this.currentCommittish))
      .replace('{{cache-key}}', this.cacheKey);
  };

  insertDropdown = (dropdown) => {
    if (document.getElementById('template-selector')) {
      return;
    }

    const sidebarContainer = document.querySelector('.discussion-sidebar-item:nth-child(2)');
    sidebarContainer.insertAdjacentHTML('afterend', dropdown);
  };

  activateDropdown = () => {
    const selector = document.querySelector('#template-selector');
    selector.addEventListener('click', this.onClick, true);
  };

  setPullRequestBody = (template) => {
    const textarea = document.getElementById('pull_request_body');
    textarea.value = this.templates[template];
  };

  updateTemplateSelector = (template, url) => {
    this.setTemplateSelectorRadio(template);
    this.setTemplateSelectorState(template, url);
    this.setTemplateSelectorLabel(template);
  };

  setTemplateSelectorRadio = (template) => {
    const radio = document.querySelector(`input[value="${template}"]`);
    radio.checked = true;
    radio.dispatchEvent(new CustomEvent('change', { bubbles: true }));
  };

  setTemplateSelectorState = (template, url) => {
    const refSelector = document.querySelector('#template-selector ref-selector');

    if (template === 'default') {
      url.searchParams.delete('template');
      refSelector.removeAttribute('current-committish');
    } else {
      url.searchParams.set('template', template);
      refSelector.setAttribute('current-committish', btoa(template));
    }

    refSelector.dispatchEvent(new CustomEvent('input-entered', { detail: '' }));
  };

  setTemplateSelectorLabel = (template) => {
    const span = document.querySelector('#template-selector summary span');
    span.innerHTML = template;
  };

  updateWindowLocation = (url) => {
    window.history.pushState(null, null, url);
  };

  onClick = (e) => {
    const item = e.target.closest('.SelectMenu-item');
    if (item) {
      const template = item.getAttribute('data-ref-name');
      const url = new URL(window.location);

      this.setPullRequestBody(template);
      this.updateTemplateSelector(template, url);
      this.updateWindowLocation(url);

      e.preventDefault();
    }
  };
}

const onLocationChange = (event) => {
  if (!event.target.location.href.match(/https?:\/\/github\.com\/.+\/compare\/.+$/)) {
    return;
  }
  if (document.getElementById('template-selector')) {
    return;
  }

  const repository = new GithubRepository();
  repository.attachDropdown();
};

window.addEventListener('statechange', onLocationChange);
