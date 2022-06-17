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
        .replace('{{current-committish}}', btoa(currentCommittish))
        .replace('{{cache-key}}', cacheKey);
};

const insertDropdown = (dropdown) => {
    const tabNav = document.querySelector('#partial-discussion-sidebar');
    tabNav.innerHTML += dropdown;
};

const activateDropdown = () => {
    const selector = document.querySelector('#template-selector');
    selector.addEventListener('click', onClick, true);
};

const onClick = (e) => {
    const item = e.target.closest('.SelectMenu-item');
    if (item) {
        const template = item.getAttribute('data-ref-name');

        const span = document.querySelector('#template-selector summary span');
        span.innerHTML = template;

        const textarea = document.getElementById('pull_request_body');
        textarea.value = templates[template];

        const url = new URL(window.location);
        const refSelector = document.querySelector('#template-selector ref-selector');

        if (template === 'default') {
            url.searchParams.delete('template');
            refSelector.removeAttribute('current-committish');
        } else {
            url.searchParams.set('template', template);
            refSelector.setAttribute('current-committish', btoa(template));
        }

        window.history.pushState(null, null, url);

        const radio = e.target.parentElement.querySelector('input');
        radio.checked = true;
        radio.dispatchEvent(new CustomEvent('change', {bubbles: true}));

        refSelector.dispatchEvent(new CustomEvent('input-entered', {detail: ''}));

        e.preventDefault();
    }
};

Promise.resolve()
    .then(() => loadTemplates())
    .then(() => fetchExtensionHtml('dropdown.html'))
    .then(generateDropdown)
    .then(insertDropdown)
    .then(activateDropdown)
    .catch(console.error);