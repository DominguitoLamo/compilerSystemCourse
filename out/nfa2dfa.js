"use strict";
function nfa2Dfa(nfa) {
    const dfa = {
        states: new Set(),
        startState: eClosure(nfa.startState, nfa),
        transitions: new Map(),
        acceptingStates: new Set()
    };
    const queue = [dfa.startState];
    while (queue.length > 0) {
        const currentState = queue.shift();
        dfa.states.add(currentState);
        const transitionMap = new Map();
        for (const c of nfa.char) {
            const charStates = moveWithChar(c, currentState, nfa);
            const nextStates = eClosure(charStates, nfa);
            transitionMap.set(c, nextStates);
            if (nextStates && !dfa.states.has(nextStates)) {
                queue.push(nextStates);
            }
        }
        dfa.transitions.set(currentState, transitionMap);
        const isAccepted = currentState.split(',').some(s => nfa.acceptingStates.has(s));
        if (isAccepted) {
            dfa.acceptingStates.add(currentState);
        }
    }
    return dfa;
}
// Computes the epsilon closure of a set of states
function eClosure(states, nfa) {
    var _a;
    const eClosureStates = new Set(typeof states === "string" ? [states] : states);
    const visited = new Set();
    const stack = [...eClosureStates];
    while (stack.length > 0) {
        const stateName = stack.shift();
        const state = nfa.states.find((s) => s.name === stateName);
        for (const epsilonTransition of (_a = state.transitions.get("ε")) !== null && _a !== void 0 ? _a : []) {
            if (!visited.has(epsilonTransition)) {
                eClosureStates.add(epsilonTransition);
                stack.push(epsilonTransition);
            }
        }
    }
    return [...eClosureStates].sort().join(",");
}
function moveWithChar(char, currentState, nfa) {
    if (!currentState) {
        return new Set();
    }
    const states = currentState.split(',').map(i => i.trim());
    const charStates = states.reduce((acc, s) => {
        const charTransition = nfa.states.find(stateItem => stateItem.name === s).transitions.get(char);
        if (charTransition) {
            charTransition.forEach(i => acc.add(i));
        }
        return acc;
    }, new Set());
    return charStates;
}
function dfaModified(dfa) {
    const map = [...dfa.states].reduce((acc, item, index) => {
        acc.set(item, `d${index}`);
        return acc;
    }, new Map());
    const newDfa = {
        states: new Set(map.values()),
        startState: map.get(dfa.startState),
        acceptingStates: [...dfa.acceptingStates].reduce((acc, item) => {
            acc.add(map.get(item));
            return acc;
        }, new Set()),
        transitions: [...dfa.transitions.entries()].reduce((acc, item) => {
            const newTransition = new Map();
            const state = item[0];
            const transition = item[1];
            transition.forEach((val, key) => {
                newTransition.set(key, map.get(val) || '');
            });
            acc.set(map.get(state), newTransition);
            return acc;
        }, new Map())
    };
    return newDfa;
}
// Example usage:
const nfa = {
    states: [
        {
            name: "q0",
            transitions: new Map([
                ["a", new Set(["q1"])],
                ["ε", new Set(["q2"])],
            ]),
            isAccepting: false,
        },
        {
            name: "q1",
            transitions: new Map([
                ["b", new Set(["q3"])],
            ]),
            isAccepting: false,
        },
        {
            name: "q2",
            transitions: new Map([
                ["b", new Set(["q3"])],
            ]),
            isAccepting: false,
        },
        {
            name: "q3",
            transitions: new Map(),
            isAccepting: true,
        },
    ],
    char: ['a', 'b'],
    startState: "q0",
    acceptingStates: new Set(["q3"]),
};
// a(b|c)*
const nfa1 = {
    states: [
        {
            name: 'q0',
            transitions: new Map([
                ['a', new Set(['q1'])]
            ]),
            isAccepting: false
        },
        {
            name: 'q1',
            transitions: new Map([
                ['ε', new Set(['q2'])]
            ]),
            isAccepting: false
        },
        {
            name: 'q2',
            transitions: new Map([
                ['ε', new Set(['q3', 'q9'])]
            ]),
            isAccepting: false
        },
        {
            name: 'q3',
            transitions: new Map([
                ['ε', new Set(['q4', 'q6'])]
            ]),
            isAccepting: false
        },
        {
            name: 'q4',
            transitions: new Map([
                ['b', new Set(['q5'])]
            ]),
            isAccepting: false
        },
        {
            name: 'q5',
            transitions: new Map([
                ['ε', new Set(['q8'])]
            ]),
            isAccepting: false
        },
        {
            name: 'q6',
            transitions: new Map([
                ['c', new Set(['q7'])]
            ]),
            isAccepting: false
        },
        {
            name: 'q7',
            transitions: new Map([
                ['ε', new Set(['q8'])]
            ]),
            isAccepting: false
        },
        {
            name: 'q8',
            transitions: new Map([
                ['ε', new Set(['q3', 'q9'])]
            ]),
            isAccepting: false
        },
        {
            name: 'q9',
            transitions: new Map(),
            isAccepting: true
        },
    ],
    char: ['a', 'b', 'c'],
    startState: 'q0',
    acceptingStates: new Set(['q9'])
};
const dfa = nfa2Dfa(nfa1);
console.log("DFA states:", dfa.states);
console.log("DFA start state:", dfa.startState);
console.log("DFA transitions:", dfa.transitions);
console.log("DFA accepting states:", dfa.acceptingStates);
const newDfa = dfaModified(dfa);
console.log("DFA Modified states:", newDfa.states);
console.log("DFA Modified start state:", newDfa.startState);
console.log("DFA Modified transitions:", newDfa.transitions);
console.log("DFA Modified accepting states:", newDfa.acceptingStates);
//# sourceMappingURL=nfa2dfa.js.map