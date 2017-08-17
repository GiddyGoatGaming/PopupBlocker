// Below is exposed for testing. It shouldn't be used for other purposes.
export const SupportedLocales = {
    "en": "RESOURCE:EN_TRANSLATIONS"
};

let currentLocale = null;
if (typeof AdguardSettings !== 'undefined') {
    var locale = AdguardSettings.locale;
    if (SupportedLocales[locale]) {
        currentLocale = locale;
    }
}
if (!currentLocale) {
    currentLocale = 'en';
}

const getMessage = (messageId:string):string => {
    let message = SupportedLocales[currentLocale][messageId];
    // @ifdef DEBUG
    if (!message) { throw messageId + ' not localized'; }
    // @endif
    return message['message'];
};

type stringmap = {
    [id:string]:string
};

// Marks start of placeholders, ${...} or <.../>.
const rePhStart = /(?:\${|<)/;
// Below is exposed for testing. It shouldn't be used for other purposes.
export function parseMessage(message:string, context:stringmap):(string|number)[] {
    const res:(string|number)[] = [];
    let text:string = '';
    let match:RegExpMatchArray;
    let ind:number, i:number;
    while (message) {
        match = rePhStart.exec(message);
        if (!match) {
            text += message;
            if (text) { res.push(text); }
            return res;
        } else {
            ind = match.index;
            text += message.substr(0, ind);
            if (match[0].charCodeAt(0) === 36 /* $ */) {
                ind += 2;
                i = message.indexOf('}', ind);
                let messageId = message.slice(ind, i);
                let rep = context[messageId];
                if (rep) { text += rep; }
                message = message.slice(i + 1);
            } else {
                ind++;
                i = message.indexOf('/>', ind);
                if (text) { res.push(text); }
                text = '';
                let num = message.charCodeAt(ind) - 48; // parseInt(*, 10)
                res.push(num);
                message = message.slice(i + 2);
            }
        }
    }
    if (text) { res.push(text); }
    return res;
}

const reCommentPh = /^i18n:/;
const option = 128 /* NodeFilter.SHOW_COMMENT */
export default function translate(root:Element, context:stringmap) {
    const nodeIterator = document.createNodeIterator(root, option, null, false);
    let current:Node;
    let val:string;
    // If DOM order is modified during iteration, 
    // NodeIterator may skip some nodes,
    // so we do a batch process.
    const tasks:InsertTask[] = [];
    while (current = nodeIterator.nextNode()) {
        val = current.nodeValue;
        if (reCommentPh.test(val)) {
            val = val.slice(5);
            let message = getMessage(val);
            let parsed = parseMessage(message, context);
            let pr:Element = <Element><any>current.parentNode;
            tasks.push(new InsertTask(pr, current,
                parsed.map((el) => {
                    if (typeof el == 'number') {
                        return nthElemSib(current, el);
                    } else {
                        return document.createTextNode(el);
                    }
                })
            ));
        }
    }
    for (let i = 0, l = tasks.length; i < l; i++) {
        tasks[i].insert();
    }
}

class InsertTask {
    constructor(private pr:Element, private before:Node, private toInsert:Node[]) { }
    insert() {
        for (let i = 0, l = this.toInsert.length; i < l; i++) {
            this.pr.insertBefore(this.toInsert[i], this.before);
        }
        this.pr.removeChild(this.before);
    }
}

function nthElemSib(node:Node, index:number) {
    let el = node;
    while (index-- >= 0) { el = el['nextElementSibling']; }
    return el;
}
