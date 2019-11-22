# Treact

这是一个用来实践 `React` 核心思想的的练习库，主要功能包含如下：

- `createElement`
- `render`
- `useState`
- 时间切片
- 和解
- 函数组件

另外，为了方便书写方便，编写了一个类似 `JSX` 语法的小模版，用于将文本转为 `React Element`

### 例子

```js
function Counter() {
  const [count, setCount] = Treact.useState(0)

  const elements = []
  for (let i = 0; i < count; i++) {
    elements.push(Treact.t`<h5>i am ${i} element.</h5>`)
  }

  return Treact.t`
    <div>
      <p>Click ${count} times</p>
      <button onClick="${() => {
        setCount((c) => c - 1)
      }}">Click Me -1</button>
      <button onClick="${() => {
        setCount((c) => c + 1)
      }}">Click Me +1</button>
      ${elements}
    </div>
  `
}

Treact.render(
  Treact.t`
    <div>
      <h1 id="heihei" title="jack">Hello World!</h1>
      <${Counter}></${Counter}>
      </div>
  `,
  document.getElementById('app')
)
```

### 使用

1. `git clone https://github.com/MANSOUL/toy-react.git`
2. `npm i`
3. `npm start`
4. 浏览器打开 `http://localhost:10001/`

### Try Me

[在codesandbox中试一下](https://codesandbox.io/s/loving-surf-3cbtq?fontsize=14&hidenavigation=1&theme=dark)
