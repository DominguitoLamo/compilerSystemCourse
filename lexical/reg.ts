const EPSILON = 'ε'

interface Reg {
    pattern: string;
    len: number;
    nfa?: NFAMap;
    pStack: Array<string> // record the parenthesis
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
        pStack: []
    }

    const nfa = convert(r, 0)
    r.nfa = nfa
    
    return r
}

function convert(r: Reg, startIndex: number) : NFAMap {
    let current = startIndex
    const stack: Array<NFAMap> = []

    if (r.len === 0) {
        return emptyNFA(current)
    }

    while (current < r.len) {
        if (r.pStack.length >= 2) {
            const pLen = r.pStack.length
            if (r.pStack[pLen - 2] === '(' && r.pStack[pLen - 1] === ')') {
                break
            }
        }

        const char = r.pattern[current]

        if (char === '(') {
            r.pStack.push(char)
            current++
            const nfa = convert(r, current)

            nfa.substr += r.pStack.pop()
            nfa.len++

            current += nfa.len
            if (current > r.len) {
                throw new Error(`no close parenthesis at index ${current}`)
            }

            nfa.substr = `${r.pStack.pop()}${nfa.substr}`
            nfa.len++
            stack.push(nfa)
            
            continue
        }

        if (char === ')') {
            const pLen = r.pStack.length
            if (r.pStack[pLen - 1] !== '(' ) {
                throw new Error(`no open parenthesis. The index is ${current}`)
            }
            r.pStack.push(char)
            break
        }

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
                const nfa = orNFA(stack)
                stack.push(nfa)
                continue
            } else if (isOpenParenthesis(nextChar)) {
                const right = convert(r, current)
                current += right.len
                stack.push(right)
                const nfa = orNFA(stack)
                stack.push(nfa)
                continue
            }

            throw new Error(`wrong char ${char} after or operation at ${current}`)
        }

        if (char === '*') {
            const nfa = closureNFA(stack)
            stack.push(nfa)
            current++
            continue
        }

        throw new Error(`wrong char ${char} at ${current}`)
    }

    const nfa = concatNFA(stack, startIndex)
    return nfa
}

function isOpenParenthesis(c: string) {
    return c === '('
}

function addParenthesis(n: NFAMap) {
    n.substr = `(${n.substr})`
    n.len += 2
    return n
}

function isLetter(c: string) {
    return c >= 'a' && c <= 'z'
}

function mapSetState(nfa: NFAMap, state: number, char: string, nextState: number | Set<number>) {
    const nextStates = nextState instanceof Set ? [...nextState] : [nextState]
    if (!nfa.graph.get(state)) {
        nfa.graph.set(state, new Map())
    }
    const statePaths = nfa.graph.get(state)!
    if (!statePaths.get(char)) {
        statePaths.set(char, new Set([...nextStates]))
    } else {
        nextStates.forEach(i => statePaths.get(char)!.add(i))
    }
}

function closureNFA(stack: Array<NFAMap>): NFAMap {
    if (stack.length === 0) {
        throw new Error('no content to closure')
    }

    const nfa = stack.pop()!
    nfa.substr += '*'
    nfa.len = nfa.substr.length
    
    if (!nfa.isIn && !nfa.isOut) {
        mapSetState(nfa, nfa.acceptStates[0], EPSILON, 0)
        mapSetState(nfa, 0, EPSILON, nfa.acceptStates[0])
        nfa.isIn = true
        nfa.isOut = true
        return nfa
    }

    if (!nfa.isIn && nfa.isOut) {
        nfa.graph.set(nfa.acceptStates[0] + 1, new Map())
        mapSetState(nfa, nfa.acceptStates[0], EPSILON, 0)
        mapSetState(nfa, 0, EPSILON, nfa.acceptStates[0] + 1)
        mapSetState(nfa, nfa.acceptStates[0], EPSILON, nfa.acceptStates[0] + 1)

        nfa.acceptStates[0] = nfa.acceptStates[0] + 1
        nfa.stateNum++
        nfa.isIn = true
        nfa.isOut = false
        return nfa
    }

    if (nfa.isIn && !nfa.isOut) {
        nfa.graph.set(nfa.acceptStates[0] + 1, new Map())
        nfa.acceptStates[0] = nfa.acceptStates[0] + 1
        nfa.stateNum++
        reNumState(nfa, 1)
        mapSetState(nfa, 0, EPSILON, nfa.acceptStates[0])
        mapSetState(nfa, 0, EPSILON, 1)
        mapSetState(nfa, nfa.acceptStates[0], EPSILON, 1)

        nfa.isIn = false
        nfa.isOut = true
        return nfa
    }

    if (nfa.isIn && nfa.isOut) {
        nfa.graph.set(nfa.acceptStates[0] + 1, new Map())
        mapSetState(nfa, nfa.acceptStates[0], EPSILON, nfa.acceptStates[0] + 1)
        mapSetState(nfa, nfa.acceptStates[0], EPSILON, 0)
        nfa.acceptStates[0] = nfa.acceptStates[0] + 1
        nfa.stateNum++

        reNumState(nfa, 1)

        mapSetState(nfa, 0, EPSILON, nfa.acceptStates[0])
        mapSetState(nfa, 0, EPSILON, 1)

        nfa.isIn = false
        nfa.isOut = false
        return nfa
    }

    return nfa
}

function orNFA(stack: Array<NFAMap>) : NFAMap {
    if (stack.length < 2) {
        throw new Error('less than 2 elements in stack')
    }

    let right = nfaOrModify(stack.pop()!)!
    let left = nfaOrModify(stack.pop()!)!

    reNumState(right, left.stateNum)

    right.graph.get(left.stateNum)?.forEach((nexts, c) => mapSetState(left, 0, c, nexts))
    right.graph.delete(left.stateNum)
    
    for (const [state, path] of right.graph.entries()!) {
        path.forEach((next, c) => {
            if (next.has(right.acceptStates[0])) {
                next.delete(right.acceptStates[0])
                next.add(left.acceptStates[0])
            }
            mapSetState(left, state, c, next)
        })
    }

    right.char.forEach(i => left.char.add(i))
    left.stateNum += (right.stateNum - 1)
    left.substr += `|${right.substr}`
    left.len = left.substr.length
    return left
}

function nfaOrModify(nfa: NFAMap) {
    if (!nfa.isIn && !nfa.isOut) {
        return nfa
    }

    if (!nfa.isIn && nfa.isOut) {
        nfa.graph.set(nfa.acceptStates[0] + 1, new Map())
        mapSetState(nfa, nfa.acceptStates[0], EPSILON, nfa.acceptStates[0] + 1)

        nfa.acceptStates[0]++
        nfa.stateNum++
        nfa.isOut = false
        return nfa
    }

    if (nfa.isIn && !nfa.isOut) {
        reNumState(nfa, 1)
        mapSetState(nfa, 0, EPSILON, 1)

        nfa.stateNum++
        nfa.isIn = false
        return nfa
    }

    if (nfa.isIn && nfa.isOut) {
        nfa.graph.set(nfa.acceptStates[0] + 1, new Map())
        mapSetState(nfa, nfa.acceptStates[0], EPSILON, nfa.acceptStates[0] + 1)
        nfa.acceptStates[0]++
        nfa.stateNum++

        reNumState(nfa, 1)
        mapSetState(nfa, 0, EPSILON, 1)
        nfa.stateNum++

        nfa.isIn = false
        nfa.isOut = false
        return nfa
    }

    return nfa
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
        nfa.len = nfa.substr.length
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
                path.forEach((next, c) => mapSetState(nfa, state, c, next))
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

    const r10 = regexp2Nfa("(cd|(ab)*)")
    printReg(r10)
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