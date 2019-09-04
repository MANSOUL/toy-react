import toyReact, { Component, t, render } from '../src'

class HelloWorld extends Component {
  render () {
    const greeting = 'Hello World!'
    return t`
      <p>${greeting}</p>
    `
  }
}

class App extends Component {
  render () {
    return t`
      <${HelloWorld} />
    `
  }
}

render(
  t`<${App} />`,
  document.getElementById('app')
)
