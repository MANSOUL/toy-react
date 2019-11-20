import { setUnitOfWork } from './concurrent'

export default function render (element, container) {
  setUnitOfWork({
    dom: container,
    props: {
      children: [element]
    }
  })
}
