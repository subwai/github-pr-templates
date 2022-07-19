const url = new URL(window.location);
const [, nameWithOwner, , branch] = url.pathname.match(/\/(.+)\/compare\/(.+\.\.\.)?(.+)/);
const defaultTemplate = 'default';
const project = 'pr-templates';
const localStoragePath = `${nameWithOwner}:${project}`;
const localStoragePathFull = `ref-selector:${localStoragePath}:tag`;
const cacheKey = project;
const baseURL = `https://github.com/${nameWithOwner}`;
const currentCommittish = url.searchParams.get('template') || 'default';
const templates = {};

// utils
const zipObject = (props, values) => {
    return props.reduce((prev, prop, i) => {
        return Object.assign(prev, {[prop]: values[i]});
    }, {});
};

const baseName = (path) => {
    return String(path).substring(path.lastIndexOf('/') + 1);
};

const fetchGithub = (path) => {
    return fetch(`${baseURL}${path}`, {credentials: 'same-origin'})
        .then(res => res.text());
}

const fetchTemplate = (path) => {
    return fetchGithub(`/raw/${branch}/.github/${path}`);
};

// business logic
const loadTemplates = () => {
    return Promise.all([
        fetchDefaultTemplate(),
        fetchCustomTemplates()
    ])
        .then(([defaultTemplate, customTemplates]) => {
            templates['default'] = defaultTemplate;
            Object.assign(templates, customTemplates);
            const refs = Object.keys(templates);

            localStorage.setItem(localStoragePathFull, JSON.stringify({refs, cacheKey}));
        });
};

const fetchDefaultTemplate = () => {
    return fetchTemplate('pull_request_template.md');
};

const fetchCustomTemplates = () => {
    return fetchGithub(`/tree/${branch}/.github/PULL_REQUEST_TEMPLATE`)
        .then(html => {
            const regex = new RegExp(/href=".+(PULL_REQUEST_TEMPLATE\/.+\.md)"/g);
            const templateUrls = [...html.matchAll(regex)].map(match => match[1]);
            const templateBaseNames = templateUrls.map(baseName);

            return Promise.all(templateUrls.map(fetchTemplate))
                .then(templates => zipObject(templateBaseNames, templates));
        });
}

const fetchExtensionHtml = (path) => {
    return fetch(chrome.runtime.getURL(path))
        .then((response) => response.text());
}

const generateDropdown = (dropdownTemplate) => {
    return dropdownTemplate
        .replace('{{default-template}}', defaultTemplate)
        .replace('{{default-template64}}', btoa(defaultTemplate))
        .replace('{{name-with-owner64}}', btoa(localStoragePath))
        .replace('{{current-committish}}', currentCommittish)
        .replace('{{current-committish64}}', btoa(currentCommittish))
        .replace('{{cache-key}}', cacheKey);
};

const insertDropdown = (dropdown) => {
    if (document.getElementById('template-selector')) {
        return;
    }

    const sidebarContainer = document.querySelector('.discussion-sidebar-item:nth-child(2)');
    sidebarContainer.insertAdjacentHTML('afterend', dropdown);
};

const activateDropdown = () => {
    const selector = document.querySelector('#template-selector');
    selector.addEventListener('click', onClick, true);
};

const setPullRequestBody = (template) => {
    const textarea = document.getElementById('pull_request_body');
    textarea.value = templates[template];
};

const updateTemplateSelector = (template, url) => {
    setTemplateSelectorRadio(template);
    setTemplateSelectorState(template, url);
    setTemplateSelectorLabel(template);
};

const setTemplateSelectorRadio = (template) => {
    const radio = document.querySelector(`input[value="${template}"]`);
    radio.checked = true;
    radio.dispatchEvent(new CustomEvent('change', {bubbles: true}));
};

const setTemplateSelectorState = (template, url) => {
    const refSelector = document.querySelector('#template-selector ref-selector');

    if (template === 'default') {
        url.searchParams.delete('template');
        refSelector.removeAttribute('current-committish');
    } else {
        url.searchParams.set('template', template);
        refSelector.setAttribute('current-committish', btoa(template));
    }

    refSelector.dispatchEvent(new CustomEvent('input-entered', {detail: ''}));
};

const setTemplateSelectorLabel = (template) => {
    const span = document.querySelector('#template-selector summary span');
    span.innerHTML = template;
};

const updateWindowLocation = (url) => {
    window.history.pushState(null, null, url);
};

const onClick = (e) => {
    const item = e.target.closest('.SelectMenu-item');
    if (item) {
        const template = item.getAttribute('data-ref-name');
        const url = new URL(window.location);

        setPullRequestBody(template);
        updateTemplateSelector(template, url);
        updateWindowLocation(url);

        e.preventDefault();
    }
};

const onLocationChange = (event) => {
    if (!event.target.location.href.match(/https?:\/\/github\.com\/.+\/compare\/.+$/)) {
        return;
    }
    if (document.getElementById('template-selector')) {
        return;
    }

    Promise.resolve()
        .then(() => loadTemplates())
        .then(() => fetchExtensionHtml('dropdown.html'))
        .then(generateDropdown)
        .then(insertDropdown)
        .then(activateDropdown)
        .catch(console.error);
};

window.addEventListener('statechange', onLocationChange);
