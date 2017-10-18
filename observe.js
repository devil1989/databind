/*
 *author:chenjiajie
 *time:2017/10/16
 *description:数据单向绑定，data>dom绑定
 */

//属性和dom节点绑定是多对多的关系，多对多的关系，一个dom节点中可以包含多个key，一个key也可以让多个dom节点引用；
//data和dom最好还是别做双向绑定，万一data修改导致dom变化，dom修改又导致data修改，死循环了，数据还是单项绑定比较好

/*
 *desc：观察者模式,数据监控类，用于监控一个对象的内容是否变更,然后通知对应的观察者
  @param
  sub={
 	key："事件名称"//这里都是name.age.key这种属性格式
	actionList：回调函数
 }
 */
var Observer=function(opts){
	this.id=(opts&&opts.id)?opts.id:+new Date();
	this.opts=opts;
	this.subs=[];//观察者数组
}
Observer.prototype={

	monit:function(data,baseUrl){
		var me=this;
		baseUrl=baseUrl||"";
		var isTypeMatch=this.isObject(data);
		if(isTypeMatch){
			Object.keys(data).forEach(function(key){
				var base=baseUrl?(baseUrl+"."+key):key;
				me.defineKey(data,key,data[key],baseUrl);//定义自己
				me.monit(data[key],base);//递归【定义的是下一层】
			});
		}
	},

	defineKey:function(data,key,val,baseUrl){
		var me=this;
		var base=baseUrl?(baseUrl+"."+key):key;

		Object.defineProperty(data, key,{
			enumerable: true, 
            configurable: false,
            get: function() {
                return val;
            },
            set: function(newVal) {
                if (newVal !== val) {
                    val = newVal;
	                me.monit(newVal,base);//设置新值需要重新监控
	                me.publish(base);//(baseUrl+"."+key)作为观察者模式中的监听的那个key，也可以说是监听的那个事件
                }
            }
		});
	},

	isObject:function(data){
		return data&&typeof data === "object"
	},

	//发布
	publish:function(actionType){
		(this.subs||[]).forEach(function(sub){
			if(sub.key==actionType){
				(sub.actionList||[]).forEach(function (action) {
					action();
				});
			}
		});
	},

	//订阅
	subscribe:function(key,callback){
		var tgIdx;
		var hasExist=this.subs.some(function(unit,idx){
			tgIdx=(unit.key===key)?idx:-1;
			return (unit.key===key)
		});
		if(hasExist){
			if(Object.prototype.toString.call(this.subs[tgIdx].actionList)==="[object Array]"){
				this.subs[tgIdx].actionList.push(callback);
			}else{
				this.subs[tgIdx].actionList=[callback];
			}
		}else{
			this.subs.push({
				key:key,
				actionList:[callback]
			});
		}
	},

	//取消订阅
	remove:function(key){
		var removeIdx;
		this.subs.forEach(function (sub,idx) {
			removeIdx=sub.key===key?idx:-1;
			return sub.key===key
		});
		if(removeIdx!==-1){
			this.subs.splice(removeIdx,1);
		}
	}
};



/*
 *desc：模板编译器，处理模板，把模板转义为dom，同事添加观察者（dom元素）的事件订阅：subscribe 
  unfinish:组件化，组件中插入子组件
  @param
 	observe：new Observer(),//依赖观察者模式的对象
	data：数据，
	template：魔板，
	wrapper：数据放到哪个dom元素中去（是append进去）
	handles:{
		

	}
  depend on： doT(https://github.com/olado/doT),依赖doT模板
 */
var Compile=function(opts){
	this.opts=opts;
	this.ele=(opts.wrapper&&this.isElement(opts.wrapper))?opts.wrapper:document.querySelector(opts.wrapper);//dom中已经存在的元素，这个元素作为容器
	if(this.ele){
		this.ele.innerHTML=opts.template;//渲染页面
		this.fragment=this.transToFrament(this.ele);
		this.travelAllNodes(this.fragment);
		this.ele.appendChild(this.fragment);
	}
	// opts&&opts.observer&&opts.observer.subscribe(key,this.update.bind(this,ele));
};
Compile.prototype={

	//把原有节点转化成Frament节点，createDocumentFragment创建文档碎片节点，不会导致页面渲染，只有最后插入到文档时，才会渲染
	transToFrament:function(el) {
        var fragment = document.createDocumentFragment(), child;
        // 将原生节点拷贝到fragment
        while (child = el.firstChild) {
            fragment.appendChild(child);
        }
        return fragment;
    },

	//遍历所有节点
	travelAllNodes:function(ele){
		this.compileNode(ele);
		([].slice.call(ele.childNodes)||[]).forEach(function(node){
			this.compileNode(node);
			if(node.childNodes&&node.childNodes.length){
				this.travelAllNodes(node);
			}
		}.bind(this));
	},

	//编译node节点[把data的key和node节点绑定，有个mapping的关系，当key变化的时候，可以通过mapping来找到对应的node，然后根据node上面的]
	/*包含功能
	 1.渲染node（根据对应的data.name来寻找对应的值，然后替换）
	 2.绑定node和key的关联事件【在node中添加该key的function，function中定义key改变的时候，node的如何改变】，这样一来，key改变，观察者对象便利所有包含key的node，执行每个关联node里面的key所对应的事件
	 */
	compileNode:function(){
		if(this.isElement(node)){
			this.compileElementNode(node);
		}else if(this.isText(node)){
			this.compileTextNode(node);
		}
	},

	//编译element类型的node节点,需要处理属性绑定v-bind="{{data.name}}"和事件v-event="{{data.event}}"
	compileElementNode:function(node){
		var me = this,nodeAttrs = node.attributes;
        [].slice.call(nodeAttrs).forEach(function(attr) {
            var attrName = attr.name;
            var attrValue = attr.value;
            attr.value=me.compileString(attrValue);//渲染node
            me.bindKeyToNode(attrValue,attr);
        });
	},

	//编译文本类型的node节点，里面放了对应的"{{data.name}}"这种数据格式
	compileTextNode:function(ele){
		var value=ele.textContent;
		ele.textContent=this.compileString(value);
		this.bindKeyToNode(value,ele);
	},

	//解析“{{}}”，把它变成对应的数据值
	compileString:function(str){

	},

	//把str中的key绑定到node元素上去
	bindKeyToNode:function(str,node){

	},

    isElement:function(ele){
		return ele.nodeType===1?true:false;
	},
	isText:function(ele){
		return ele.nodeType===3?true:false;
	}
}

//learn from https://github.com/devil1989/mvvm

//unfinish：
// key绑定到node的方法bindKeyToNode
// 给node元素添加事件句柄：可以暂时不写