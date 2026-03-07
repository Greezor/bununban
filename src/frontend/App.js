import Nav from './components/Nav'

export default {
	template: `
		<RouterView v-slot="{ Component }">
			<KeepAlive>
				<component :is="Component" />
			</KeepAlive>
		</RouterView>

		<Nav v-if="$route.path !== '/login'" />
	`,
	components: {
		Nav,
	},
}