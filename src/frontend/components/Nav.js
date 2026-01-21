import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { css } from '@emotion/css'
import { Icon } from '@iconify/vue'

const style = {
	nav: css`
		position: fixed;
		padding: 20px;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		overflow: auto;
		pointer-events: none;
		z-index: 99;
	`,

	navMenu: css`
		position: relative;
		margin: auto;
		padding: 5px;
		font-size: 0;
		display: flex;
		align-items: center;
		border-radius: 100px;
		pointer-events: auto;
	`,

	navBtn: css`
		padding: 10px 20px;
		flex: 0 0 66px;
		color: #222;
		border-radius: 100px;
		transition: all 0.2s ease;
	`,

	navBtnActive: css`
		color: #ffcd19;
		transform: scale(1.15);
		transition: all 0.3s ease 0.2s;
	`,

	navIcon: css`
		font-size: 26px;
	`,

	navCursor: css`
		--pos: 0;
		--liquid-blur: blur(0px);
		--liquid-filter: url(#liquid-glass-50);
		position: absolute;
		top: 4px;
		left: 5px;
		bottom: 4px;
		width: 66px;
		border-radius: 100px;
		background: transparent;
		transition: all 0.5s ease;
		transform: translateX(calc(100% * var(--pos)));
		pointer-events: none;
	`,
}

export default {
	setup()
	{
		const route = useRoute();

		const navCursorPos = computed(() => {
			if( route.path === '/' )
				return 0;

			if( route.path.startsWith('/profiles') )
				return 1;

			if( route.path.startsWith('/lists') )
				return 2;

			if( route.path.startsWith('/lua') )
				return 3;

			if( route.path.startsWith('/blobs') )
				return 4;

			if( route.path.startsWith('/startup') )
				return 5;

			if( route.path.startsWith('/logs') )
				return 6;

			if( route.path.startsWith('/settings') )
				return 7;
		});

		return { navCursorPos };
	},
	template: `
		<div class="${ style.nav }">
			<div
				class="${ style.navMenu } liquid-glass">
				<RouterLink
					class="${ style.navBtn }"
					active-class="${ style.navBtnActive }"
					to="/"
					draggable="false">
					<Icon class="${ style.navIcon }" icon="material-symbols:home-rounded" />
				</RouterLink>

				<RouterLink
					class="${ style.navBtn }"
					active-class="${ style.navBtnActive }"
					to="/profiles"
					draggable="false">
					<Icon class="${ style.navIcon }" icon="fa7-solid:pills" />
				</RouterLink>

				<RouterLink
					class="${ style.navBtn }"
					active-class="${ style.navBtnActive }"
					to="/lists"
					draggable="false">
					<Icon class="${ style.navIcon }" icon="fa7-solid:file-alt" />
				</RouterLink>

				<RouterLink
					class="${ style.navBtn }"
					active-class="${ style.navBtnActive }"
					to="/lua"
					draggable="false">
					<Icon class="${ style.navIcon }" icon="fa7-solid:file-code" />
				</RouterLink>

				<RouterLink
					class="${ style.navBtn }"
					active-class="${ style.navBtnActive }"
					to="/blobs"
					draggable="false">
					<Icon class="${ style.navIcon }" icon="fa7-solid:square-binary" />
				</RouterLink>

				<RouterLink
					class="${ style.navBtn }"
					active-class="${ style.navBtnActive }"
					to="/startup"
					draggable="false">
					<Icon class="${ style.navIcon }" icon="material-symbols:rocket-launch-rounded" />
				</RouterLink>

				<RouterLink
					class="${ style.navBtn }"
					active-class="${ style.navBtnActive }"
					to="/logs"
					draggable="false">
					<Icon class="${ style.navIcon }" icon="material-symbols:contract" />
				</RouterLink>

				<RouterLink
					class="${ style.navBtn }"
					active-class="${ style.navBtnActive }"
					to="/settings"
					draggable="false">
					<Icon class="${ style.navIcon }" icon="material-symbols:settings" />
				</RouterLink>

				<div
					class="${ style.navCursor } liquid-glass"
					:style="{
						'--pos': navCursorPos,
					}">
				</div>
			</div>
		</div>
	`,
	components: {
		Icon,
	},
}