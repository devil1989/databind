# 如何实现VM框架中的数据绑定

## 一：数据绑定概述
	视图（view）和数据（model）之间的绑定

## 二：数据绑定目的
	不用手动调用方法渲染视图，提高开发效率；统一处理数据，便于维护

## 三：数据绑定中的元素
	视图（view）：说白了就是html中dom元素的展示
	数据（model）：浏览器中的数据，localStorage , sessionStorage , js中的object等

## 四：数据绑定分类
	view > model的数据绑定：view改变，导致model改变
	model > view的数据绑定：model改变，导致view改变

## 五：数据绑定实现方法
	view > model的数据绑定实现方法
			修改dom元素（input,textarea,select）的数据，导致model产生变化，
			只要给dom元素绑定change事件，触发事件的时候修改model即可，不细讲

	model > view的数据绑定实现方法
			1.发布订阅模式（backbone.js用到）；
			2.数据劫持(vue.js用到)；
			3.脏值检查(angular.js用到)；


## 六：model > view数据绑定demo讲解 （如何实现数据改变，导致UI界面重新渲染）

	demo简易思路 
	> 1.通过defineProperty来监控model中的所有属性（对每一个属性都监控）
	> 2.编译template生成DOM树，同时绑定dom节点和model（例如<div id="{{model.name}}"></div>）,
		defineProperty中已经给“model.name”绑定了对应的function，
		一旦model.name改变，该funciton就操作上面这个dom节点，改变view
	
	demo使用方法
		<!DOCTYPE html>
		<html lang="en">
			<head>
				<meta charset="UTF-8">
				<title>Document</title>
				<link rel="stylesheet" type="text/css" href="demo.css">
				<script type="text/javascript" src="./observe.js"></script>
			</head>
			<body>
				<template id="inner" type="text/template">
					<!-- 只支持单个属性，不支持函数计算-->
					<div title="{{des}}">
						<div>
							<ul id="list">
								<li >
									<span >age:</span>
									<input  type="text" name="" value="{{age}}" >
									<span id="age" style="float: left;">+</span>
								</li>
								<li>
									<span>name:</span>
									<input type="text" name="" value="{{name}}">
								</li>
							</ul>
						</div>
						
					</div>
				</template>

				<script type="text/javascript">
					(function(){
						window.data={name:"jeffrey",age:28,des:"测试"};
						var vm=new VM({
							data:data,
							template:document.getElementById("inner").innerHTML
							// wrapper:document.body//可以指定对应容器，也可以不指定容器
						});
						document.body.appendChild(vm.get());

						document.getElementById("age").addEventListener("click",function(){
							data.age++;
						});
					})();
				</script>
			</body>
		</html>

		使用方法： new VM({data:数据,template:模板});
	
	
	主要js模块：Observer,Compile,ViewModel

		1.Observer
			用到了发布订阅模式和数据监控，defineProperty用于“监控model", dom元素执行"订阅"操作，给model中
			的属性绑定function；model中属性变化的时候，执行"发布"这个操作，执行之前绑定的那个function

	  	源码如下：
		var Observer = function(opts) {
			this.id = (opts && opts.id) ? opts.id : +new Date();
			this.opts = opts;
			this.subs = []; //观察者数组
			/*this.subs包含了所有观察者，每个观察者的结构如下：
			{
				key："person.age.range",//这个key代表model.person.age.range这个属性

				/*
				 和key绑定的函数数组，每个函数操作一个dom节点，
				 一个key对应多个dom节点，所以actionList是个function数组；
				 */
				actionList：[function(){},function(){}]
			}*/
		}
		Observer.prototype = {

			//遍历model中所有的属性，每个属性用defineKey来监控所有属性
			monit: function(data, baseUrl) {
				var me = this;
				baseUrl = baseUrl || "";
				var isTypeMatch = (data && typeof data === "object");
				if (isTypeMatch) {
					Object.keys(data).forEach(function(key) {
						var base = baseUrl ? (baseUrl + "." + key) : key;
						me.defineKey(data, key, data[key], baseUrl); //定义自己
						me.monit(data[key], base); //递归【定义的是下一层】
					});
				}
			},

			//用到了Object.defineProperty来定义属性，这样属性改变的时候，就会自动执行里面的set方法
			defineKey: function(data, key, val, baseUrl) {
				var me = this;
				var base = baseUrl ? (baseUrl + "." + key) : key;

				Object.defineProperty(data, key, {
					enumerable: true,
					configurable: false,
					get: function() {
						return val;
					},

					//更新并监控新的值，执行publish函数
					set: function(newVal) {
						if (newVal !== val) {
							val = newVal;

							//设置新值需要重新监控
							me.monit(newVal, base); 

							//(baseUrl+"."+key)作为观察者模式中的监听的那个key，也可以说是监听的那个事件
							me.publish(base, newVal); 
						}
					}
				});
			},

			/*
			 根据key来执行绑定在这个key上的所有函数，比如说person.age.range这个key，
			 它变动的时候，publish会执行绑定在person.age.range这个key上所有的function
			 */
			publish: function(key, newVal) {
				(this.subs || []).forEach(function(sub) {
					if (sub.key == key) {
						(sub.actionList || []).forEach(function(action) {
							action(newVal);
						});
					}
				});
			},

			//给model中的某个key（例如person.age.range)添加绑定的function 
			subscribe: function(key, callback) {
				var tgIdx;
				var hasExist = this.subs.some(function(unit, idx) {
					tgIdx = (unit.key === key) ? idx : -1;
					return (unit.key === key)
				});
				if (hasExist) {
					if (Object.prototype.toString.call(this.subs[tgIdx].actionList)=="[object Array]"){
						this.subs[tgIdx].actionList.push(callback);
					} else {
						this.subs[tgIdx].actionList = [callback];
					}
				} else {
					this.subs.push({
						key: key,
						actionList: [callback]
					});
				}
			},

			//取消订阅
			remove: function(key) {
				var removeIdx;
				this.subs.forEach(function(sub, idx) {
					removeIdx = sub.key === key ? idx : -1;
					return sub.key === key
				});
				if (removeIdx !== -1) {
					this.subs.splice(removeIdx, 1);
				}
			},

			isObject: function(data) {
				return data && typeof data === "object"
			}
		};



		2.Compile： 模板编译器
		var Compile = function(opts) {
			this.opts = opts;
			this.data = this.opts.data;
			this.observer = this.opts.observer;
			this.regExp = /\{\{([\s\S]*)\}\}/;
			this.ele = document.createElement("div");
			this.ele.innerHTML = opts.template; //渲染页面
			this.fragment = this.transToFrament(this.ele);
			this.travelAllNodes(this.fragment);
			this.ele.appendChild(this.fragment);
		};
		Compile.prototype = {

			//把页面上的dom节点转化成文档碎片，防止dom频繁操作影响页面性能
			transToFrament: function(el) {
				var fragment = document.createDocumentFragment(),
					child;
				// 将原生节点拷贝到fragment
				while (child = el.firstChild) {
					fragment.appendChild(child);
				}
				return fragment;
			},

			//遍历文档碎片节点下所有的node节点（用到了函数递归调用）,执行compileNode
			travelAllNodes: function(ele) {
				this.compileNode(ele);
				([].slice.call(ele.childNodes) || []).forEach(function(node) {
					this.compileNode(node);
					if (node.childNodes && node.childNodes.length) {
						this.travelAllNodes(node);
					}
				}.bind(this));
			},

			/*包含功能
			 1.渲染node节点
			 2.给key设置callback函数，函数内操作node节点
			 */
			compileNode: function(node) {
				if (this.isElement(node)) {
					this.compileElementNode(node);
				} else if (this.isText(node)) {
					this.compileTextNode(node);
				}
			},

			/*
			  编译element类型的node节点,
			  需要处理属性绑定v-bind="{{data.name}}"和
			  事件v-event="{{data.event}}"
			 */
			compileElementNode: function(node) {
				var me = this,
					nodeAttrs = node.attributes;
				[].slice.call(nodeAttrs).forEach(function(attr) {
					var attrName = attr.name;
					var attrValue = attr.value;
					var key = me.getKey(attrValue);
					me.bindKeyToNode(key, attr);
					attr.value = me.compileString(attrValue); //渲染node
				});
			},

			//编译文本类型的node节点，里面放了对应的"{{data.name}}"这种数据格式
			compileTextNode: function(ele) {
				var key = this.getKey(ele.textContent);
				this.bindKeyToNode(key, ele);
				ele.textContent = this.compileString(ele.textContent);
			},

			//解析“{{}}”，把它变成对应的数据值
			compileString: function(str) {
				var key = this.getKey(str);
				return str.replace(this.regExp, this.getValueByKey(key));
			},

			//绑定key和node节点，key一旦改变，就会触发对应的函数，修改node节点
			bindKeyToNode: function(key, node) {
				if (!!key.trim()) {
					console.log(key);
					var nodeType = node.nodeType;
					var regExp = new RegExp("\\{\\{" + key + "\\}\\}");
					var originTextConetnt;
					if (nodeType === 2) {
						originTextConetnt = node.value;
					} else if (nodeType === 3) {
						originTextConetnt = node.textContent;
					}

					this.observer.subscribe(key, function(newVal) {
						var tgValue = originTextConetnt.replace(regExp, newVal);
						if (nodeType === 2) {
							node.value = tgValue;
						} else if (nodeType === 3) {
							node.textContent = tgValue;
						}
					});
				}
			},

			//从{{name.age.sex}}中获取name.age.sex
			getKey: function(str) {
				return str.match(this.regExp) ? str.match(this.regExp)[1] : "";
			},

			//获取key对应的value值
			getValueByKey: function(key) {
				var arr = key ? key.split(".") : [];
				var temp = this.data;
				for (var i = 0; i < arr.length; i++) {
					if (temp) {
						temp = temp[arr[i]];
					} else {
						temp = undefined;
						break
					}
				}
				return temp;
			},


			isElement: function(ele) {
				return ele.nodeType === 1 ? true : false;
			},
			isText: function(ele) {
				return ele.nodeType === 3 ? true : false;
			},
			getElement: function() {
				return this.ele;
			}
		}




		3.ViewModel：结合Observer与Compile，实现model > view的数据单向绑定
		var ViewModel = function(opts) {
			this.opts = opts;
			this.data = opts.data;
			this.wrapper = opts.wrapper;
			this.template = opts.template;
			this.Observer = (typeof Observer != undefined) ? Observer : opts.Observer;
			this.Compile = (typeof Compile != undefined) ? Compile : opts.Compile;
			this.init();
		}

		ViewModel.prototype = {
			init: function() {
				var opts = this.opts;
				this.observer = new this.Observer(opts);
				this.observer.monit(this.data); //监控数据变化，数据已经改变了
				this.compiler = new this.Compile(Object.assign(opts, {
					observer: this.observer
				})); //编译生成节点
				if (this.wrapper) {
					this.wrapper.appendChild(this.compiler.getElement());
				}
			},
			get: function() {
				return this.compiler.getElement();
			}
		};
		
		
# 总结
	简单地调用new ViewModel({data:data,template:template})，
	完成了model和view的绑定,ViewModel内部大致执行顺序是：

	1. 创建数据监控对象this.observer，该对象监控data（监控以后，data的属性改变，
	   就会执行defineProperty中的set函数，set函数里面添加了publish发布函数）

	2. 创建模板编译器对象this.compiler，该对象编译template，生成最终的dom树，
	   并且给每个需要绑定数据的dom节点添加了subscribe订阅函数

	3. 最后，改变data里面的属性，会自动触发defineProperty中的set函数，set函数调用publish函数，
	   publish会根据key的名称，找到对应的需要执行的函数列表，依次执行所有函数
	
	
	感谢阅读!!


		
# Git地址
  https://github.com/devil1989/databind/