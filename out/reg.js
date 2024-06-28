"use strict";
const EPSILON = 'ε';
function regexp2Nfa(pattern) {
    const r = {
        pattern: pattern,
        len: pattern.length,
    };
    const [nfa, err] = convert(r, 0);
    if (!err) {
        r.nfa = nfa;
    }
    else {
        console.error(err.message);
    }
    return r;
}
function convert(r, startIndex) {
    let current = startIndex;
    const stack = [];
    if (r.len === 0) {
        return [emptyNFA(current), null];
    }
    while (current < r.len) {
        const char = r.pattern[current];
        if (isLetter(char)) {
            stack.push(charNFA(char, current));
            current++;
            continue;
        }
        if (char === '|') {
            current++;
            const nextChar = r.pattern[current];
            if (isLetter(nextChar)) {
                stack.push(charNFA(nextChar, current));
                const nfa = orNFA(stack, startIndex);
                stack.push(nfa);
                continue;
            }
            throw new Error(`wrong char ${char} after or operation at ${current}`);
        }
        return [null, new Error(`wrong char ${char} at ${current}`)];
    }
    const nfa = concatNFA(stack, startIndex);
    return [nfa, null];
}
function isLetter(c) {
    return c >= 'a' && c <= 'z';
}
function orNFA(stack, index) {
    if (stack.length < 2) {
        throw new Error('less than 2 elements in stack');
    }
    let right = nfaOrModify(stack.pop());
    let left = nfaOrModify(stack.pop());
    reNumState(right, left.stateNum);
    for (const [state, path] of right.graph.entries()) {
        if (right.acceptStates.includes(state)) {
            continue;
        }
        path.forEach((val, key) => {
            if (val.has(right.acceptStates[0])) {
                val.delete(right.acceptStates[0]);
                val.add(left.acceptStates[0]);
            }
            // handle the first element of right nfa 
            if (state === left.stateNum) {
                const firstMap = left.graph.get(0);
                firstMap === null || firstMap === void 0 ? void 0 : firstMap.set(key, val);
            }
        });
        if (state === left.stateNum) {
            continue;
        }
        left.graph.set(state, path);
    }
    right.char.forEach(i => left.char.add(i));
    left.stateNum += (right.stateNum - 1);
    left.substr += `|${right.substr}`;
    return left;
}
function nfaOrModify(nfa) {
    if (!nfa.isIn && !nfa.isOut) {
        return nfa;
    }
}
function concatNFA(stack, index) {
    if (stack.length === 1) {
        return stack.pop();
    }
    let start = index;
    // init
    const nfa = emptyNFA(start);
    nfa.stateNum = 0;
    nfa.graph = new Map();
    while (stack.length !== 0) {
        const current = stack.shift();
        nfa.substr = `${nfa.substr}${current.substr}`;
        current.char.forEach(c => nfa.char.add(c));
        if (nfa.isOut && (current === null || current === void 0 ? void 0 : current.isIn)) {
            nfa.isOut = current.isOut;
            nfa.isIn = false;
            nfa.acceptStates.forEach(accept => {
                const acceptMap = nfa.graph.get(accept);
                const espilonSet = [...acceptMap.get(EPSILON), nfa.stateNum++];
                acceptMap.set(EPSILON, new Set(espilonSet));
            });
            nfa.graph.set(nfa.stateNum, new Map());
            reNumState(current, nfa.stateNum);
            nfa.stateNum = nfa.stateNum + current.stateNum;
            current.graph.forEach((path, state) => {
                nfa.graph.set(state, path);
            });
            nfa.acceptStates = current.acceptStates;
        }
        else {
            nfa.isOut = current.isOut;
            reNumState(current, nfa.stateNum);
            nfa.stateNum = nfa.stateNum + current.stateNum;
            current.graph.forEach((path, state) => {
                nfa.graph.set(state, path);
            });
            nfa.acceptStates = current.acceptStates;
        }
    }
    return nfa;
}
function reNumState(nfa, startIndex) {
    const newGraph = new Map();
    const newAccepted = [];
    nfa.graph.forEach((paths, state) => {
        const newState = state + startIndex;
        newGraph.set(newState, new Map());
        if (nfa.acceptStates.includes(state)) {
            newAccepted.push(newState);
        }
        paths.forEach((next, char) => {
            var _a;
            const newNext = new Set();
            next.forEach(i => newNext.add(i + startIndex));
            (_a = newGraph.get(newState)) === null || _a === void 0 ? void 0 : _a.set(char, newNext);
        });
    });
    nfa.graph = newGraph;
    nfa.acceptStates = newAccepted;
}
function charNFA(c, index) {
    const nfa = {
        substr: c,
        startIndex: index,
        len: 1,
        char: new Set([c]),
        isIn: false,
        isOut: false,
        stateNum: 1,
        acceptStates: [1],
        graph: new Map([
            [0, new Map([
                    [c, new Set([1])]
                ])],
            [1, new Map()]
        ])
    };
    return nfa;
}
function emptyNFA(index) {
    const nfa = {
        substr: "",
        startIndex: index,
        len: 0,
        char: new Set(),
        isIn: false,
        isOut: false,
        stateNum: 1,
        acceptStates: [1],
        graph: new Map([
            [0, new Map([
                    [EPSILON, new Set([1])]
                ])],
            [1, new Map()]
        ])
    };
    return nfa;
}
function testReg() {
    const r0 = regexp2Nfa("");
    printReg(r0);
    const r1 = regexp2Nfa("a");
    printReg(r1);
    const r2 = regexp2Nfa("abc");
    printReg(r2);
    const r3 = regexp2Nfa("b|c");
    printReg(r3);
    const r4 = regexp2Nfa("ab|c");
    printReg(r4);
}
function printReg(r) {
    var _a;
    console.log(`pattern: ${r.pattern}`);
    pringNfa(r.nfa);
    console.log(`accepted states: ${(_a = r.nfa) === null || _a === void 0 ? void 0 : _a.acceptStates}`);
    console.log('\n');
}
function pringNfa(nfa) {
    nfa.graph.forEach((val, key) => {
        console.log(`${key}=>`);
        val.forEach((next, char) => {
            console.log(`   ${char}->${[...next].join()}`);
        });
    });
}
testReg();
//# sourceMappingURL=reg.js.map