"use strict";
const EPSILON = 'ε';
function regexp2Nfa(pattern) {
    const r = {
        pattern: pattern,
        len: pattern.length,
        pStack: []
    };
    const nfa = convert(r, 0);
    r.nfa = nfa;
    return r;
}
function convert(r, startIndex) {
    let current = startIndex;
    const stack = [];
    if (r.len === 0) {
        return emptyNFA(current);
    }
    while (current < r.len) {
        if (r.pStack.length >= 2) {
            const pLen = r.pStack.length;
            if (r.pStack[pLen - 2] === '(' && r.pStack[pLen - 1] === ')') {
                break;
            }
        }
        const char = r.pattern[current];
        if (char === '(') {
            r.pStack.push(char);
            current++;
            const nfa = convert(r, current);
            nfa.substr += r.pStack.pop();
            nfa.len++;
            current += nfa.len;
            if (current > r.len) {
                throw new Error(`no close parenthesis at index ${current}`);
            }
            nfa.substr = `${r.pStack.pop()}${nfa.substr}`;
            nfa.len++;
            stack.push(nfa);
            continue;
        }
        if (char === ')') {
            const pLen = r.pStack.length;
            if (r.pStack[pLen - 1] !== '(') {
                throw new Error(`no open parenthesis. The index is ${current}`);
            }
            r.pStack.push(char);
            break;
        }
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
                current++;
                const nfa = orNFA(stack);
                stack.push(nfa);
                continue;
            }
            else if (isOpenParenthesis(nextChar)) {
                const right = convert(r, current);
                current += right.len;
                stack.push(right);
                const nfa = orNFA(stack);
                stack.push(nfa);
                continue;
            }
            throw new Error(`wrong char ${char} after or operation at ${current}`);
        }
        if (char === '*') {
            const nfa = closureNFA(stack);
            stack.push(nfa);
            current++;
            continue;
        }
        throw new Error(`wrong char ${char} at ${current}`);
    }
    const nfa = concatNFA(stack, startIndex);
    return nfa;
}
function isOpenParenthesis(c) {
    return c === '(';
}
function addParenthesis(n) {
    n.substr = `(${n.substr})`;
    n.len += 2;
    return n;
}
function isLetter(c) {
    return c >= 'a' && c <= 'z';
}
function mapSetState(nfa, state, char, nextState) {
    const nextStates = nextState instanceof Set ? [...nextState] : [nextState];
    if (!nfa.graph.get(state)) {
        nfa.graph.set(state, new Map());
    }
    const statePaths = nfa.graph.get(state);
    if (!statePaths.get(char)) {
        statePaths.set(char, new Set([...nextStates]));
    }
    else {
        nextStates.forEach(i => statePaths.get(char).add(i));
    }
}
function closureNFA(stack) {
    if (stack.length === 0) {
        throw new Error('no content to closure');
    }
    const nfa = stack.pop();
    nfa.substr += '*';
    nfa.len = nfa.substr.length;
    if (!nfa.isIn && !nfa.isOut) {
        mapSetState(nfa, nfa.acceptStates[0], EPSILON, 0);
        mapSetState(nfa, 0, EPSILON, nfa.acceptStates[0]);
        nfa.isIn = true;
        nfa.isOut = true;
        return nfa;
    }
    if (!nfa.isIn && nfa.isOut) {
        nfa.graph.set(nfa.acceptStates[0] + 1, new Map());
        mapSetState(nfa, nfa.acceptStates[0], EPSILON, 0);
        mapSetState(nfa, 0, EPSILON, nfa.acceptStates[0] + 1);
        mapSetState(nfa, nfa.acceptStates[0], EPSILON, nfa.acceptStates[0] + 1);
        nfa.acceptStates[0] = nfa.acceptStates[0] + 1;
        nfa.stateNum++;
        nfa.isIn = true;
        nfa.isOut = false;
        return nfa;
    }
    if (nfa.isIn && !nfa.isOut) {
        nfa.graph.set(nfa.acceptStates[0] + 1, new Map());
        nfa.acceptStates[0] = nfa.acceptStates[0] + 1;
        nfa.stateNum++;
        reNumState(nfa, 1);
        mapSetState(nfa, 0, EPSILON, nfa.acceptStates[0]);
        mapSetState(nfa, 0, EPSILON, 1);
        mapSetState(nfa, nfa.acceptStates[0], EPSILON, 1);
        nfa.isIn = false;
        nfa.isOut = true;
        return nfa;
    }
    if (nfa.isIn && nfa.isOut) {
        nfa.graph.set(nfa.acceptStates[0] + 1, new Map());
        mapSetState(nfa, nfa.acceptStates[0], EPSILON, nfa.acceptStates[0] + 1);
        mapSetState(nfa, nfa.acceptStates[0], EPSILON, 0);
        nfa.acceptStates[0] = nfa.acceptStates[0] + 1;
        nfa.stateNum++;
        reNumState(nfa, 1);
        mapSetState(nfa, 0, EPSILON, nfa.acceptStates[0]);
        mapSetState(nfa, 0, EPSILON, 1);
        nfa.isIn = false;
        nfa.isOut = false;
        return nfa;
    }
    return nfa;
}
function orNFA(stack) {
    var _a;
    if (stack.length < 2) {
        throw new Error('less than 2 elements in stack');
    }
    let right = nfaOrModify(stack.pop());
    let left = nfaOrModify(stack.pop());
    reNumState(right, left.stateNum);
    (_a = right.graph.get(left.stateNum)) === null || _a === void 0 ? void 0 : _a.forEach((nexts, c) => mapSetState(left, 0, c, nexts));
    right.graph.delete(left.stateNum);
    for (const [state, path] of right.graph.entries()) {
        path.forEach((next, c) => {
            if (next.has(right.acceptStates[0])) {
                next.delete(right.acceptStates[0]);
                next.add(left.acceptStates[0]);
            }
            mapSetState(left, state, c, next);
        });
    }
    right.char.forEach(i => left.char.add(i));
    left.stateNum += (right.stateNum - 1);
    left.substr += `|${right.substr}`;
    left.len = left.substr.length;
    return left;
}
function nfaOrModify(nfa) {
    if (!nfa.isIn && !nfa.isOut) {
        return nfa;
    }
    if (!nfa.isIn && nfa.isOut) {
        nfa.graph.set(nfa.acceptStates[0] + 1, new Map());
        mapSetState(nfa, nfa.acceptStates[0], EPSILON, nfa.acceptStates[0] + 1);
        nfa.acceptStates[0]++;
        nfa.stateNum++;
        nfa.isOut = false;
        return nfa;
    }
    if (nfa.isIn && !nfa.isOut) {
        reNumState(nfa, 1);
        mapSetState(nfa, 0, EPSILON, 1);
        nfa.stateNum++;
        nfa.isIn = false;
        return nfa;
    }
    if (nfa.isIn && nfa.isOut) {
        nfa.graph.set(nfa.acceptStates[0] + 1, new Map());
        mapSetState(nfa, nfa.acceptStates[0], EPSILON, nfa.acceptStates[0] + 1);
        nfa.acceptStates[0]++;
        nfa.stateNum++;
        reNumState(nfa, 1);
        mapSetState(nfa, 0, EPSILON, 1);
        nfa.stateNum++;
        nfa.isIn = false;
        nfa.isOut = false;
        return nfa;
    }
    return nfa;
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
        nfa.len = nfa.substr.length;
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
                path.forEach((next, c) => mapSetState(nfa, state, c, next));
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
    // const r0 = regexp2Nfa("")
    // printReg(r0)
    // const r1 = regexp2Nfa("a")
    // printReg(r1)
    // const r2 = regexp2Nfa("abc")
    // printReg(r2)
    // const r3 = regexp2Nfa("b|c")
    // printReg(r3)
    // const r4 = regexp2Nfa("ab|c")
    // printReg(r4)
    // const r5 = regexp2Nfa("a*")
    // printReg(r5)
    // const r6 = regexp2Nfa("a*b")
    // printReg(r6)
    // const r7 = regexp2Nfa("a*|b")
    // printReg(r7)
    // const r8 = regexp2Nfa("(ab)|c")
    // printReg(r8)
    // const r9 = regexp2Nfa("((ab)*a)")
    // printReg(r9)
    const r10 = regexp2Nfa("(cd|(ab)*)");
    printReg(r10);
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