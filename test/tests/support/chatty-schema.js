import Schema from 'orbit-common/schema';

export default new Schema({
  models: {
    user: {
      attributes: {
        name: {type: 'string'},
      },
      relationships: {
        alterEgo: {type: 'hasOne', model: 'alterEgo', inverse: 'user'},
        chatRooms: {type: 'hasMany', model: 'chatRoom', inverse: 'users'},
      },
    },
    message: {
      attributes: {
        body: {type: 'string'},
        author: {type: 'string', defaultValue: null},
      },
      relationships: {
        chatRoom: {type: 'hasOne', model: 'chatRoom', inverse: 'messages'},
      },
    },
    chatRoom: {
      attributes: {
        name: {type: 'string'},
      },
      relationships: {
        messages: {type: 'hasMany', model: 'message', inverse: 'chatRoom'},
        users: {type: 'hasMany', model: 'user', inverse: 'users'},
      },
    },
    alterEgo: {
      attributes: {
        name: {type: 'string'},
      },
      relationships: {
        user: {type: 'hasOne', model: 'user', inverse: 'alterEgo'},
      },
    },
  },
});
