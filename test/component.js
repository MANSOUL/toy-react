import toyReact from '../src'
import ast from '../src/template/ast'
import vdom from '../src/vdom/vdom'

const { Component, t, render } = toyReact

class HelloWorld extends Component {
  render () {
    return t`
      <p>
        ${
          this.props.greeting.split('').map(c => {
            return t`<span>${c}</span>`
          })
        }
      </p>
    `
  }
}

class App extends Component {
  render () {
    return t`
      <div>
        <${HelloWorld} greeting="Hello World!"></${HelloWorld}>
        <${HelloWorld} greeting="Hello World!"></${HelloWorld}>
      </div>
    `
  }
}

// render(
//   t`<${App} test="1"></${App}>`
//   // document.getElementById('app')
// )

console.log(ast(t`<${App} test="1"></${App}>`))
console.log(vdom(t`<${App} test="1"></${App}>`))
