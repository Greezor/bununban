import index from '../../frontend/index.html'
import routes from '../../frontend/router/routes'

export default Object.assign({}, ...(
	routes.map(({ path }) => ({ [path]: index }))
))