"use strict";

// Make a custom version of the marked renderer.

let {
    getDManFileInfo,
} = require("./utils");

let marked = require("marked");
let MAX_INDEX_HEADER_LEVEL = 2;
let MAX_NAV_HEADER_LEVEL = 3;

let normalizeAnchorName = function(raw) {
    return raw
        // Convert any *space characters* per:
        // http://www.w3.org/TR/html5/dom.html#the-id-attribute            and
        // http://www.w3.org/TR/html5/infrastructure.html#space-character
        .replace(/[\u0020|\u0009|\u000A|\u000C|\u000D]+/g, '-');  // replace spaces to '-'
};

// Keep track of navigation items;
// Keep track of keyword -> navigation item lookup table.


let addAnchor = function(target, anchorText, anchorId, icon) {
    // push toAdd to target
    let toAdd = Object.create(null);
    toAdd.text = anchorText;
    toAdd.id = anchorId;
    toAdd.icon = icon;
    toAdd.children = [];
    target.push(toAdd);
};

let findAnchor = function(target, anchorId) {
    for (let i = 0; i <= target.length; i++) {
        if (target[i].id === anchorId) {
            return target[i];
        }
    }
    throw new Error(`Cannot find anchor ${anchorId}.`);
};

let parseNavigationItems = function(tokens) {
    let anchors = []; // This is the return value.
    let anchorIds = new Set(); // This is used to detect duplicate anchor ids.

    let currentHeaderId = null;
    let currentHeaderId1 = null;  // h1 header.
    let currentHeaderText = null;

    let appInfo = {
        name: null,
        icon: null,
    };
    let indices = [];
    let headers = [];

    for (let token of tokens) {
        if (token.type === "heading") {
            let extracted = extractHeaderIcon(token.text, token.depth);
            let anchorText = extracted.text;
            let icon = extracted.icon;

            // Lookfor and set appName
            if (token.depth === 1) {
                if (appInfo.name) {
                    throw new Error("Redefinition appInfo");
                }
                appInfo.name = anchorText;
                appInfo.icon = icon;
            }

            let anchorId = normalizeAnchorName(anchorText);

            if (token.depth <= MAX_INDEX_HEADER_LEVEL) {
                if (anchorIds.has(anchorId)) {
                    throw new Error("Duplicate anchor names found:", anchorId);
                } else {
                    anchorIds.add(anchorId);
                    headers.push(anchorText);
                }
            } else {
//                continue;
            }
            currentHeaderId = anchorId;
            currentHeaderText = anchorText;

            if (token.depth === 2) {
                if (!appInfo.name) {
                    throw new Error("H2 must be under H1.");
                }
                currentHeaderId1 = anchorId;
                addAnchor(anchors, anchorText, anchorId, icon);
            } else if (token.depth === 3) {
                let anchor_lv1 = findAnchor(anchors, currentHeaderId1);
                addAnchor(anchor_lv1.children, anchorText, anchorId, icon);
            }
        } else {
            if (token.type === "paragraph" || token.type === "text") {
                if ((indices.length === 0) ||
                    (indices[indices.length - 1].header !== currentHeaderId)) {
                    indices.push({
                        headerId: currentHeaderId,
                        headerText: currentHeaderText,
                        texts: [],
                    })
                }
                indices[indices.length - 1].texts.push(token.text);
            }
        }

    }

    return {
        appInfo: appInfo,  // set logo, icon, and window's title
        anchors: anchors,  // for navigation purposes
        indices: indices,  // for indexing and searching reasons
        headers: headers,  // for search auto-completion
    }
};

let extractHeaderIcon = function(text, level) {
    let icon = null;
    if (level >= MAX_NAV_HEADER_LEVEL) {
        return {
            icon: icon,
            text: text,
        }
    }
    let re = /\|\S+\|$/;
    let matches = re.exec(text);
    if (matches && matches.length > 0) {
        let match = matches[0];
        icon = match.substring(1, match.length - 1);
        text = text.substring(0, text.length - match.length);
    }
    return {
        icon: icon,
        text: text,
    }
};

let getRenderer = function() {
    let renderer = new marked.Renderer();

    renderer.heading = function(text, level, raw) {
        if (level > MAX_NAV_HEADER_LEVEL) {
            // Do not give h4, h5, h6 anchors.
            return '<h' + level + '>'
                + text
                + '</h' + level + '>\n';
        }

        let result = "";

        let extracted = extractHeaderIcon(text, level);

        result += '<h' + level + ' id="'
        + normalizeAnchorName(extracted.text)
        + '">';
        if (extracted.icon) {
            result += '<img class="HeaderIcon" src="' + extracted.icon + '" />';
        }
        result += extracted.text
        + '</h' + level + '>\n';
        return result;
    };

    renderer.image = function(href, title, text) {
        let re = /^\d+\|/;
        let matches = re.exec(text);
        let imgNum;
        if (matches && matches.length > 0) {
            let match = matches[0];
            text = text.substr(match.length);
            imgNum = parseInt(match);
        }
        let out = '<img src="' + href + '" alt="' + text + '"';
        if (title) {
            out += ' title="' + title + '"';
        }
        if (imgNum) {
            out += ' class="block' + imgNum + '"';
        } else {
            if (imgNum === 0) {

            } else {
                out += ' class="inline"';
            }
        }
        out += this.options.xhtml ? '/>' : '>';
        return out;
    };

    renderer.link = function(href, title, text) {
        if (href.indexOf("#") === 0) {
            href = "javascript: window.parent.jumpTo('" + href.substring(1) + "');";
        }
        let out = '<a href="' + href + '"';
        if (title) {
            out += ' title="' + title + '"';
        }
        out += '>' + text + '</a>';
        return out;
    };
    return renderer;
};

let loadMarkdown = function(url, callback) {
    let info = getDManFileInfo(url);

    let parsed = new URL(url);
    switch (parsed.protocol) {
        case "http:":
        case "https:":
            if (typeof XMLHttpRequest !== "undefined") {
                // browser
                let xmlHttp = new XMLHttpRequest();
                xmlHttp.open("GET", url, true);
                xmlHttp.send();
                xmlHttp.onreadystatechange = function(target, type, bubbles, cancelable) {
                    if (xmlHttp.readyState === 4 && xmlHttp.status === 200) {
                        callback(null, {
                            markdown: xmlHttp.responseText,
                            fileInfo: info,
                        });
                    }
                };
                xmlHttp.onerror = function(event) {
                    callback(new Error(event),
                             null);
                };
            } else {
                callback(new Error("No way to access Http(s)."),
                         null);
            }
            break;
        case "file:":
            console.log("File scheme!");
            if (typeof XMLHttpRequest !== "undefined") {
                // browser
                let xmlHttp = new XMLHttpRequest();
                xmlHttp.open("GET", url, true);
                xmlHttp.send();
                xmlHttp.onreadystatechange = function(target, type, bubbles, cancelable) {
                    if (xmlHttp.readyState === 4) {
                        callback(null, {
                            markdown: xmlHttp.responseText,
                            fileInfo: info,
                        });
                    }
                };
                xmlHttp.onerror = function(event) {
                    callback(new Error(event),
                             null);
                };
            } else if (typeof process !== "undefined") {
                // atom-shell / nw.js
                let fs = require("fs");
                fs.readFile(url, function(error, data) {
                    if (error) {
                        callback(error, null);
                    } else {
                        callback(null, {
                            markdown: data.toString(),
                            fileInfo: info,
                        });
                    }
                });
            } else {
                callback(new Error("No way to access file system."),
                         null);
            }
            break;
        default:
            callback(new Error(`Don't know what to do with the protocol(${parsed.protocol})`),
                     null);
            break;
    }
};

let parseMarkdown = function(md) {
    let renderer = getRenderer();
    let html = marked(md, {
        renderer: renderer,
    });
    let lexer = new marked.Lexer({});
    let tokens = lexer.lex(md);

    let parsed = parseNavigationItems(tokens);
    return {
        parsed: parsed,
        html: html,
    }
};

if (typeof exports !== "undefined") {
    exports.loadMarkdown = loadMarkdown;
    exports.getRenderer = getRenderer;
    exports.parseMarkdown = parseMarkdown;
}
