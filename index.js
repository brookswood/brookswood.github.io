const chatCompletion = (apiKey, data) => {
    const endpoint = 'https://api.openai.com/v1/chat/completions'
    data.model = "gpt-3.5-turbo"

    return fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(data)
    })
        .then(response => response.json())
        .catch(error => {
            console.error('Error:', error)
        })
}

const hideStartView = () => {
    document.querySelector('#start-view').classList.add('hidden')
}

const showStartView = () => {
    document.querySelector('#start-view').classList.remove('hidden')
}

const setupAPIKeyInput = () => {
    const element = document.querySelector('#api-key')
    const savedAPIKey = localStorage.getItem('api-key') || ''
    element.value = savedAPIKey
    element.addEventListener('input', () => {
        const key = element.value
        console.log('saving:', key)
        localStorage.setItem('api-key', key)
        if (key) {
            hideStartView()
        } else {
            showStartView()
        }
    })

    if (savedAPIKey) {
        hideStartView()
    }
}

const renderMarkdown = md => {
    return DOMPurify.sanitize(marked.parse(md, {
        gfm: true
    }))
}

const addMessage = (message, type) => {
    const element = document.querySelector('#output')

    const messageContainer = document.createElement('div')
    messageContainer.classList.add(`${type}-container`)
    element.appendChild(messageContainer)

    const messageBubble = document.createElement('div')
    messageBubble.classList.add(`${type}-bubble`)
    messageBubble.classList.add('message-bubble')
    messageBubble.innerHTML = renderMarkdown(message)
    messageContainer.appendChild(messageBubble)

    const copiedIndicator = document.createElement('span')
    copiedIndicator.classList.add('copied-indicator')
    messageContainer.appendChild(copiedIndicator)

    messageBubble.addEventListener('click', () => {
        navigator.clipboard.writeText(message)
        .then(() => {
            copiedIndicator.innerText = 'Copied!'
        })
        .catch((error) => {
            alert('Error copying text to clipboard:', error)
        })
    })

    window.addEventListener('click', () => {
        const oldCopiedIndicators = document.querySelectorAll('.copied-indicator')
        for (const indicator of oldCopiedIndicators) {
            indicator.innerText = ''
        }
    })

    return messageContainer
}

const addSentMessage = message => {
    return addMessage(message, 'my-message')
}

const addReceivedMessage = message => {
    return addMessage(message, 'response')
}

const addErrorMessage = (message, type) => {
    const element = document.querySelector('#output')

    const messageContainer = document.createElement('div')
    messageContainer.classList.add(`${type}-container`)
    messageContainer.classList.add('error')
    element.appendChild(messageContainer)

    messageContainer.innerText = message

    return messageContainer
}

const smoothScroll = (targetPosition, duration) => {
    const currentPosition = window.pageYOffset
    const distance = targetPosition - currentPosition
    const startTime = performance.now()

    const easeInOutQuad = (t, b, c, d) => {
        t /= d / 2
        if (t < 1) return (c / 2) * t * t + b
        t--
        return (-c / 2) * (t * (t - 2) - 1) + b
    }

    const animationCallback = (time) => {
        const elapsedTime = time - startTime
        const scroll = easeInOutQuad(elapsedTime, currentPosition, distance, duration)
        window.scrollTo(0, scroll)
        if (elapsedTime < duration) requestAnimationFrame(animationCallback)
    }

    requestAnimationFrame(animationCallback)
}

const isScrolledToBottom = () => {
    const { scrollTop, clientHeight, scrollHeight } = document.documentElement
    return scrollTop + clientHeight >= scrollHeight
}

const updateTextareaSize = (element) => {
    element.style.height = 0

    const style = window.getComputedStyle(element)
    const paddingTop = parseFloat(style.getPropertyValue('padding-top'))
    const paddingBottom = parseFloat(style.getPropertyValue('padding-bottom'))

    const height = element.scrollHeight - paddingTop - paddingBottom

    element.style.height = `${height}px`
}

window.addEventListener('load', () => {
    setupAPIKeyInput()

    let messages = [
        {
            "role": "system",
            "content": "Response format is ALWAYS markdown, especially for code."
        }
    ]

    const submitMessage = () => {
        const input = document.querySelector('#prompt').value
        document.querySelector('#prompt').value = ''

        addSentMessage(input)
        // scroll down always after sending message, even if wasn't before
        smoothScroll(document.body.scrollHeight, 500)

        const dot = '&#x25CF;'
        const typingIndicatorElement = addReceivedMessage(`${dot} ${dot} ${dot}`)

        messages.push({
            'role': 'user',
            'content': input
        })

        const apiKey = localStorage.getItem('api-key')

        const response = chatCompletion(apiKey, {
            messages
        })

        response.then(message => {
            typingIndicatorElement.remove()
            const wasScrolledToBottom = isScrolledToBottom()

            if ('error' in message) {
                addErrorMessage(message.error.message, 'assistant')

            } else if ('choices' in message) {
                message = message.choices[0].message
                messages.push(message)
                addReceivedMessage(message.content)
            }

            if (wasScrolledToBottom) smoothScroll(document.body.scrollHeight, 500)
        })
    }

    const textbox = document.querySelector('#prompt')

    textbox.addEventListener('keydown', (event) => {
        if (event.code === 'Enter' && !event.ctrlKey && !event.altKey && !event.shiftKey) {
            event.preventDefault()
            submitMessage()
            updateTextareaSize(textbox)
        }
    })

    document.querySelector('form').addEventListener('submit', (event) => {
        event.preventDefault()
        submitMessage()
        updateTextareaSize(textbox)
    })

    textbox.addEventListener("input", () => {
        updateTextareaSize(textbox)
    })
    updateTextareaSize(textbox)

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js').then(function(registration) {
            console.log('ServiceWorker registration successful with scope: ', registration.scope)
        }, (error) => {
            console.log('ServiceWorker registration failed: ', error)
        })
    }
})