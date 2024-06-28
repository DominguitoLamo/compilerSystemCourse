interface State {
    name: string;
    transitions: Map<string, Set<string>>;
    isAccepting: boolean;
}

interface NFA {
    states: State[];
    char: Array<string>;
    startState: string;
    acceptingStates: Set<string>;
}

interface DFA {
    states: Set<string>;
    startState: string;
    transitions: Map<string, Map<string, string>>
    acceptingStates: Set<string>
}

function nfa2Dfa(nfa: NFA): DFA {
    const dfa: DFA = {
        states: new Set(),
        startState: eClosure(nfa.startState, nfa),
        transitions: new Map(),
        acceptingStates: new Set()
    }

    const queue = [dfa.startState]
    while (queue.length > 0) {
        const currentState = queue.shift()!
        dfa.states.add(currentState)

        const transitionMap = new Map<string, string>()
        for (const c of nfa.char) {
            const charStates = moveWithChar(c, currentState, nfa)
            const nextStates = eClosure(charStates, nfa)

            transitionMap.set(c, nextStates)

            if (nextStates && !dfa.states.has(nextStates)) {
                queue.push(nextStates)
            }
        }

        dfa.transitions.set(currentState, transitionMap)

        const isAccepted = currentState.split(',').some(s => nfa.acceptingStates.has(s))
        if (isAccepted) {
            dfa.acceptingStates.add(currentState)
        }
    }

    return dfa
}

// Computes the epsilon closure of a set of states
function eClosure(states: string | Set<string>, nfa: NFA): string {
    const eClosureStates = new Set(typeof states === "string" ? [states] : states)
    const visited = new Set()
    const stack = [...eClosureStates]
  
    while (stack.length > 0) {
        const stateName = stack.shift()
        const state = nfa.states.find((s) => s.name === stateName)!;
        for (const epsilonTransition of state.transitions.get("ε") ?? []) {
            if (!visited.has(epsilonTransition)) {
                eClosureStates.add(epsilonTransition)
                stack.push(epsilonTransition)
            }
        }
    }
  
    return [...eClosureStates].sort().join(",");
}

function moveWithChar(char: string, currentState: string, nfa: NFA) {
    if (!currentState) {
        return new Set<string>()
    }

    const states = currentState.split(',').map(i => i.trim())
    const charStates = states.reduce((acc, s) => {
        const charTransition = nfa.states.find(stateItem => stateItem.name === s)!.transitions.get(char) as Set<string>
        if (charTransition) {
            charTransition.forEach(i => acc.add(i))
        }

        return acc
    }, new Set<string>())


    return charStates
}

function dfaModified(dfa: DFA): DFA {
    const map = [...dfa.states].reduce((acc, item, index) => {
        acc.set(item, `d${index}`)
        return acc
    }, new Map<string, string>())

    const newDfa : DFA = {
        states: new Set(map.values()),
        startState: map.get(dfa.startState)!,
        acceptingStates: [...dfa.acceptingStates].reduce((acc, item) => {
            acc.add(map.get(item)!)
            return acc
        }, new Set<string>()),
        transitions: [...dfa.transitions.entries()].reduce((acc, item) => {
            const newTransition = new Map<string, string>()
            const state = item[0]
            const transition = item[1]

            transition.forEach((val, key) => {
                newTransition.set(key, map.get(val) || '')
            })
            acc.set(map.get(state)!, newTransition)

            return acc
        }, new Map<string, Map<string, string>>()
        )
    }

    return newDfa
}

// Example usage:
const nfa: NFA = {
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
}

// a(b|c)*
const nfa1: NFA = {
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
                ['ε', new Set(['q3','q9'])]
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
}
  
const dfa = nfa2Dfa(nfa1)
console.log("DFA states:", dfa.states)
console.log("DFA start state:", dfa.startState)
console.log("DFA transitions:", dfa.transitions)
console.log("DFA accepting states:", dfa.acceptingStates)

const newDfa = dfaModified(dfa)
console.log("DFA Modified states:", newDfa.states)
console.log("DFA Modified start state:", newDfa.startState)
console.log("DFA Modified transitions:", newDfa.transitions)
console.log("DFA Modified accepting states:", newDfa.acceptingStates)