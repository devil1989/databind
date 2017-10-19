(function(){
	window.data={name:"jeffrey",age:28,des:"测试"};
	var vm=new VM({
		data:data,
		template:document.getElementById("inner").innerHTML
		// wrapper:document.body//可以指定对应容器，也可以不指定容器，直接获取元素，再手动插入对应dom元素
	});
	document.body.appendChild(vm.get());
})();
	