document.addEventListener('DOMContentLoaded', () => {
    // Open links in a new tab when clicked
    const links = document.querySelectorAll('a[target="_blank"]');
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const url = link.getAttribute('href');
            if (url) {
                if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
                    chrome.tabs.create({ url });
                } else {
                    window.open(url, '_blank');
                }
            }
        });
    });
});
