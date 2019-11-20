import { setUnitOfWork, setWipRoot } from './concurrent'

export default function render (element, container) {
  const fiberRoot = {
    dom: container,
    props: {
      children: [element]
    },
    alternate: null
  }
  setUnitOfWork(fiberRoot)
  setWipRoot(fiberRoot)
}
