/*
 *author:chenjiajie
 *time:2017/10/16
 *description:数据单向绑定，data>dom绑定
 //属性和dom节点绑定是多对多的关系，多对多的关系，一个dom节点中可以包含多个key，一个key也可以让多个dom节点引用；
 //data和dom最好还是别做双向绑定，万一data修改导致dom变化，dom修改又导致data修改，死循环了，数据还是单项绑定比较好

 待优化：还不支持事件
 待优化: 一个属性节点或者一个文本节点里面有多个key，例如<div title="{{str.age}} fds {{age}}"></div>
 待优化：属性里面不支持js，只支持属性.值
 待优化：不支持if语句和for循环
 待深度优化：如果循环语句中有key的改变，这个会非常消耗性能，因为每次key改变，都会重新渲染；应该在定义set的时候，做一个setTimeout的操作，
 注意点：给每个节点绑定回调函数，而不是用模板引擎统一重新渲染，是因为模板重新渲染需要重新绑定dom的事件
 */



/*
 *desc：观察者模式,数据监控类，用于监控一个对象的内容是否变更,然后通知对应的观察者
  @param
  sub={
 	key："事件名称"//这里都是name.age.key这种属性格式
	actionList：回调函数列表，用于操作和这个key项关联的node，一个回调函数针对一个node；actiionList是个list，所以包含了多个node的操作
 }
 */
var Observer = function(opts) {
	this.id = (opts && opts.id) ? opts.id : +new Date();
	this.opts = opts;
	this.subs = []; //观察者数组
}
Observer.prototype = {

	//监控数据
	monit: function(data, baseUrl) {
		var me = this;
		baseUrl = baseUrl || "";
		var isTypeMatch = this.isObject(data);
		if (isTypeMatch) {
			Object.keys(data).forEach(function(key) {
				var base = baseUrl ? (baseUrl + "." + key) : key;
				me.defineKey(data, key, data[key], baseUrl); //定义自己
				me.monit(data[key], base); //递归【定义的是下一层】
			});
		}
	},

	//定义数据
	defineKey: function(data, key, val, baseUrl) {
		var me = this;
		var base = baseUrl ? (baseUrl + "." + key) : key;

		Object.defineProperty(data, key, {
			enumerable: true,
			configurable: false,
			get: function() {
				return val;
			},
			set: function(newVal) {
				if (newVal !== val) {
					val = newVal;
					me.monit(newVal, base); //设置新值需要重新监控
					me.publish(base, newVal); //(baseUrl+"."+key)作为观察者模式中的监听的那个key，也可以说是监听的那个事件
				}
			}
		});
	},

	isObject: function(data) {
		return data && typeof data === "object"
	},

	//发布
	publish: function(actionType, newVal) {
		(this.subs || []).forEach(function(sub) {
			if (sub.key == actionType) {
				(sub.actionList || []).forEach(function(action) {
					action(newVal);
				});
			}
		});
	},

	//订阅
	subscribe: function(key, callback) {
		var tgIdx;
		var hasExist = this.subs.some(function(unit, idx) {
			tgIdx = (unit.key === key) ? idx : -1;
			return (unit.key === key)
		});
		if (hasExist) {
			if (Object.prototype.toString.call(this.subs[tgIdx].actionList) === "[object Array]") {
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
	}
};



/*
 *desc：模板编译器，处理模板，把模板转义为dom，同事添加观察者（dom元素）的事件订阅：subscribe 
  unfinish:组件化，组件中插入子组件
  @param
 	observe ：Observer对象,//依赖观察者模式的对象
	data：数据，
	template：魔板，
	//wrapper：数据放到哪个dom元素中去（是append进去）
	handles:{
		
	}
  depend on： doT(https://github.com/olado/doT),依赖doT模板
 */
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

	//把原有节点转化成Frament节点，createDocumentFragment创建文档碎片节点，不会导致页面渲染，只有最后插入到文档时，才会渲染
	transToFrament: function(el) {
		var fragment = document.createDocumentFragment(),
			child;
		// 将原生节点拷贝到fragment
		while (child = el.firstChild) {
			fragment.appendChild(child);
		}
		return fragment;
	},

	//遍历所有节点
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

	//编译element类型的node节点,需要处理属性绑定v-bind="{{data.name}}"和事件v-event="{{data.event}}"
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



/*实现一个数据绑定的组件*/
var VM = function(opts) {
	this.opts = opts;
	this.data = opts.data;
	this.wrapper = opts.wrapper;
	this.template = opts.template;
	this.Observer = (typeof Observer != undefined) ? Observer : opts.Observer;
	this.Compile = (typeof Compile != undefined) ? Compile : opts.Compile;
	this.init();
}

VM.prototype = {
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