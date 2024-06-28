const EPSILON = 'ε'

interface Reg {
    pattern: string;
    len: number;
    nfa?: NFAMap;
}

interface NFAMap {
    substr: string;
    startIndex: number;
    len: number;
    char: Set<string>;
    isIn: boolean; // 開始狀態有冇入邊
    isOut: boolean;  // 結束狀態有冇出邊
    stateNum: number;
    acceptStates: Array<number>;
    graph: Map<number, Map<string, Set<number>>>
}

function regexp2Nfa(pattern: string) {
    const r:Reg = {
        pattern: pattern,
        len: pattern.length,
    }

    const [nfa, err] = convert(r, 0)

    if (!err) {
        r.nfa = nfa!
    } else {
        console.error(err.message)
    }
    
    
    return r
}

function convert(r: Reg, startIndex: number) : [NFAMap | null, Error | null] {
    let current = startIndex
    const stack: Array<NFAMap> = []

    if (r.len === 0) {
        return [emptyNFA(current), null]
    }

    while (current < r.len) {
        const char = r.pattern[current]
        if (isLetter(char)) {
            stack.push(charNFA(char, current))
            current++
            continue
        }

        if (char === '|') {
            current++
            const nextChar = r.pattern[current]
            if (isLetter(nextChar)) {
                stack.push(charNFA(nextChar, current))
                current++
                const nfa = orNFA(stack, startIndex)
                stack.push(nfa)
                continue
            }

            throw new Error(`wrong char ${char} after or operation at ${current}`)
        }

        return [null, new Error(`wrong char ${char} at ${current}`)]
    }

    const nfa = concatNFA(stack, startIndex)
    return [nfa, null]
}

function isLetter(c: string) {
    return c >= 'a' && c <= 'z'
}

function orNFA(stack: Array<NFAMap>, index: number) : NFAMap {
    if (stack.length < 2) {
        throw new Error('less than 2 elements in stack')
    }

    let right = nfaOrModify(stack.pop()!)!
    let left = nfaOrModify(stack.pop()!)!

    reNumState(right, left.stateNum)
    
    for (const [state, path] of right.graph.entries()!) {
        if (right.acceptStates.includes(state)) {
            continue
        }

        path.forEach((val, key)=> {
            if (val.has(right.acceptStates[0]!)) {
                val.delete(right.acceptStates[0]!)
                val.add(left.acceptStates[0]!)
            }

            // handle the first element of right nfa 
            if (state === left.stateNum) {
                const firstMap = left.graph.get(0)
                firstMap?.set(key, val)
            }
        })

        if (state === left.stateNum) {
            continue
        }

        left.graph.set(state, path)
    }

    right.char.forEach(i => left.char.add(i))
    left.stateNum += (right.stateNum - 1)
    left.substr += `|${right.substr}`
    left.startIndex = index
    left.len = left.substr.length
    return left
}

function nfaOrModify(nfa: NFAMap) {
    if (!nfa.isIn && !nfa.isOut) {
        return nfa
    }
}

function concatNFA(stack: Array<NFAMap>, index: number) : NFAMap {
    if (stack.length === 1) {
        return stack.pop()!
    }

    let start = index

    // init
    const nfa = emptyNFA(start)
    nfa.stateNum = 0
    nfa.graph = new Map()

    while (stack.length !== 0) {
        const current = stack.shift()!
        nfa.substr = `${nfa.substr}${current.substr}`
        current.char.forEach(c => nfa.char.add(c))

        if (nfa.isOut && current?.isIn) {
            nfa.isOut = current.isOut
            nfa.isIn = false
            
            nfa.acceptStates.forEach(accept => {
                const acceptMap = nfa.graph.get(accept) as Map<string, Set<number>>
                const espilonSet = [...acceptMap.get(EPSILON) as Set<number>, nfa.stateNum++]
                acceptMap.set(EPSILON, new Set(espilonSet))
            })
            nfa.graph.set(nfa.stateNum, new Map())

            reNumState(current, nfa.stateNum)
            nfa.stateNum = nfa.stateNum + current.stateNum
            current.graph.forEach((path, state) => {
                nfa.graph.set(state, path)
            })
            nfa.acceptStates = current.acceptStates
        } else {
            nfa.isOut = current.isOut
            reNumState(current, nfa.stateNum)
            nfa.stateNum = nfa.stateNum + current.stateNum
            current.graph.forEach((path, state) => {
                nfa.graph.set(state, path)
            })
            nfa.acceptStates = current.acceptStates
        }
    }

    return nfa
}

function reNumState(nfa: NFAMap, startIndex: number) {
    const newGraph = new Map<number, Map<string, Set<number>>>()
    const newAccepted: Array<number> = []

    nfa.graph.forEach((paths, state)=> {
        const newState = state + startIndex
        newGraph.set(newState, new Map())
        
        if (nfa.acceptStates.includes(state)) {
            newAccepted.push(newState)
        }

        paths.forEach((next, char) => {
            const newNext = new Set<number>()
            next.forEach(i => newNext.add(i + startIndex))
            newGraph.get(newState)?.set(char, newNext)
        })
    })

    nfa.graph = newGraph
    nfa.acceptStates = newAccepted
}

function charNFA(c: string, index: number) {
    const nfa: NFAMap = {
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
    }

    return nfa
}

function emptyNFA(index: number) {
    const nfa: NFAMap = {
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
    }

    return nfa
}

function testReg() {
    const r0 = regexp2Nfa("")
    printReg(r0)

    const r1 = regexp2Nfa("a")
    printReg(r1)

    const r2 = regexp2Nfa("abc")
    printReg(r2)

    const r3 = regexp2Nfa("b|c")
    printReg(r3)

    const r4 = regexp2Nfa("ab|c")
    printReg(r4)
}

function printReg(r: Reg) {
    console.log(`pattern: ${r.pattern}`)
    pringNfa(r.nfa!)
    console.log(`accepted states: ${r.nfa?.acceptStates}`)
    console.log('\n')
}

function pringNfa(nfa: NFAMap) {
    nfa.graph.forEach((val, key) => {
        console.log(`${key}=>`)
        val.forEach((next, char) => {
            console.log(`   ${char}->${[...next].join()}`)
        })
    })
}

testReg()