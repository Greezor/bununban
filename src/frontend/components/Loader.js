import { css } from '@emotion/css'
import { Icon } from '@iconify/vue'

const style = {
	loader: css`
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgb(from #fff r g b / 0.8);
		backdrop-filter: blur(2px);
		display: flex;
		justify-content: center;
		align-items: center;
		font-size: 32px;
		color: #1e1e1e;
		z-index: 999;
	`,
}

export default {
	template: `
		<div
			class="${ style.loader }">
			<Icon icon="svg-spinners:270-ring-with-bg" />
		</div>
	`,
	components: {
		Icon,
	},
}