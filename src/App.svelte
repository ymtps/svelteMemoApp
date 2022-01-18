<script lang="ts">
	import { Router, Route } from "svelte-routing";
	import List from "./pages/List.svelte";
	import Detail from "./pages/Detail.svelte";
	import "./assets/css/reset.css";
	import "./assets/css/common.css";
</script>

<style lang="scss">
	main {
		width: 544px;
		padding: 20px;
	}
</style>

<Router>
	<main>
		<h1>メモアプリ</h1>
		<Route path="" component={List} />
		<Route path="/detail" component={Detail} />
	</main>
</Router>
