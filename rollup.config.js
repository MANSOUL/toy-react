import serve from 'rollup-plugin-serve'
import livereload from 'rollup-plugin-livereload'

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/bundle.js',
    name: 'Treact',
    format: 'umd'
  },
  plugins: [
    serve('dist'),
    livereload()
  ],
  watch: {}
}
