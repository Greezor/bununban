import { css } from '@emotion/css'

const style = {
	butn: css`
		padding: 10px 20px;
		display: inline-flex;
		justify-content: center;
		align-items: center;
		gap: 10px;
		border: none;
		border-radius: 100px;
		cursor: pointer;

		&[disabled]{
			opacity: 0.3;
			pointer-events: none;
		}
	`,
}

export default {
	template: `
		<button
			class="${ style.butn } liquid-glass"
			type="button">
			<slot></slot>
		</button>
	`,
}