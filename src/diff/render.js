import { ast } from '../template/t'
export default function render (template, $root) {
  console.log(template)
  console.log(ast(template))
}
