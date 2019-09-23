import serve from 'rollup-plugin-serve'

module.exports = {
  input: 'src/index.js',
  output: {
    file: 'dist/bundle.js',
    name: 'toyReact',
    format: 'umd'
  },
  plugins: [
    serve('dist')
  ],
  watch: {}
}
