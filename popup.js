document.addEventListener('DOMContentLoaded', () => {
    const links = document.querySelectorAll('a');
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const href = link.getAttribute('href');
            if (href) {
                if (href.startsWith('mailto:')) {
                    const email = href.replace('mailto:', '');
                    // Open Gmail webmail compose page so Windows users without local Mail apps can send emails directly
                    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`;
                    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
                        chrome.tabs.create({ url: gmailUrl });
                    } else {
                        window.open(gmailUrl, '_blank');
                    }
                } else {
                    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
                        chrome.tabs.create({ url: href });
                    } else {
                        window.open(href, '_blank');
                    }
                }
            }
        });
    });
});
